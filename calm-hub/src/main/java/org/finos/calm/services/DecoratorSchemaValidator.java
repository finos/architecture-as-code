package org.finos.calm.services;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.OutputUnit;
import io.vertx.json.schema.SchemaException;
import io.vertx.json.schema.SchemaRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.finos.calm.domain.DecoratorSchemaError;
import org.finos.calm.store.classpath.ClasspathCoreSchemaStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Validates a decorator against its {@code $schema} when Hub knows that schema: a calm-schema
 * decorator Standard bundled under {@value #STANDARDS_PATH}, or the base decorator definition
 * ({@code .../meta/decorators.json#/defs/decorator}) of a bundled CALM release. Their
 * {@code $ref}s resolve offline against the meta-schemas bundled under {@value #META_SCHEMAS_PATH}.
 */
@ApplicationScoped
public class DecoratorSchemaValidator {

    static final String STANDARDS_PATH = "META-INF/decorator-standards/";
    static final String META_SCHEMAS_PATH = "META-INF/calm-schemas/";
    private static final String RELEASE_BASE_URI = "https://calm.finos.org/release/";
    private static final String DECORATOR_DEFINITION = "#/defs/decorator";
    private static final Logger LOG = LoggerFactory.getLogger(DecoratorSchemaValidator.class);

    private static final JsonSchemaOptions OPTIONS = new JsonSchemaOptions()
            .setDraft(Draft.DRAFT202012)
            .setBaseUri("https://calm.finos.org/")
            .setOutputFormat(OutputFormat.Basic);

    private final SchemaRepository repository = SchemaRepository.create(OPTIONS);
    private final Set<String> registered = new HashSet<>();
    private final Map<String, JsonObject> documents = new HashMap<>();
    private final Set<String> resolvedRefs = new HashSet<>();
    private final Set<String> knownSchemas = new HashSet<>();

    @Inject
    public DecoratorSchemaValidator(ClasspathCoreSchemaStore coreSchemaStore) {
        this(coreSchemaStore.getVersions(), STANDARDS_PATH);
    }

    DecoratorSchemaValidator(List<String> releases, String standardsPath) {
        Deque<JsonObject> pending = new ArrayDeque<>();
        for (String release : releases) {
            String id = RELEASE_BASE_URI + release + "/meta/decorators.json";
            if (registerMetaSchema(id, pending)) {
                addIfResolvable(id + DECORATOR_DEFINITION, pending);
            }
        }
        // Register every Standard before checking any, because one Standard can $ref another.
        List<String> standardIds = new ArrayList<>();
        for (String path : readLines(standardsPath + "files.txt")) {
            JsonObject standard = readJson(standardsPath + path);
            String id = standard == null ? null : register(standard);
            if (id != null) {
                pending.add(standard);
                standardIds.add(id);
            }
        }
        standardIds.forEach(id -> addIfResolvable(id, pending));
        LOG.info("Decorators with one of {} known $schema values are validated on write", knownSchemas.size());
    }

    public boolean isKnown(String schemaId) {
        return knownSchemas.contains(schemaId);
    }

    /**
     * @return the errors, or an empty list if the decorator is valid or its {@code $schema} is unknown
     */
    public List<DecoratorSchemaError> validate(JsonObject decorator) {
        if (!(decorator.getValue("$schema") instanceof String id) || !isKnown(id)) {
            return List.of();
        }
        OutputUnit result = repository.validator(id).validate(decorator);
        if (Boolean.TRUE.equals(result.getValid()) || result.getErrors() == null) {
            return List.of();
        }
        return result.getErrors().stream()
                .map(error -> new DecoratorSchemaError(pointer(error.getInstanceLocation()), error.getError()))
                .toList();
    }

    // Loads the bundled meta-schemas that the pending schemas $ref, then checks that the schema resolves.
    // A schema that does not resolve (for example in a build without the meta-schemas) stays unknown.
    private void addIfResolvable(String id, Deque<JsonObject> pending) {
        while (!pending.isEmpty()) {
            refs(pending.poll()).stream()
                    .filter(ref -> ref.startsWith(RELEASE_BASE_URI))
                    .forEach(ref -> registerMetaSchema(ref, pending));
        }
        try {
            repository.validator(id).validate(new JsonObject());
            requireRefsResolve(id);
            knownSchemas.add(id);
        } catch (RuntimeException e) {
            LOG.warn("Decorators with $schema [{}] are not validated on write: {}", id, e.getMessage());
        }
    }

    // An empty object does not reach a $ref under properties or items, so check each $ref of each bundled
    // schema that the id reaches. Otherwise a broken nested $ref fails only when a decorator reaches it.
    private void requireRefsResolve(String id) {
        Deque<String> uris = new ArrayDeque<>(List.of(documentUri(id)));
        Set<String> visited = new HashSet<>();
        while (!uris.isEmpty()) {
            String uri = uris.poll();
            JsonObject document = documents.get(uri);
            if (document == null || !visited.add(uri)) {
                continue;
            }
            for (String ref : refs(document)) {
                String target = URI.create(uri).resolve(ref).toString();
                // Hub bundles only calm.finos.org schemas, so it leaves other $refs as they were.
                if (!target.startsWith(OPTIONS.getBaseUri())) {
                    continue;
                }
                // The first pass loads only the absolute release $refs.
                if (target.startsWith(RELEASE_BASE_URI)) {
                    registerMetaSchema(target, new ArrayDeque<>());
                }
                if (!resolvedRefs.contains(target)) {
                    repository.validator(JsonSchema.of(new JsonObject().put("$ref", target)), OPTIONS).validate(new JsonObject());
                    resolvedRefs.add(target);
                }
                uris.add(documentUri(target));
            }
        }
    }

    private static String documentUri(String ref) {
        return ref.contains("#") ? ref.substring(0, ref.indexOf('#')) : ref;
    }

    private boolean registerMetaSchema(String ref, Deque<JsonObject> pending) {
        String uri = ref.contains("#") ? ref.substring(0, ref.indexOf('#')) : ref;
        if (registered.contains(uri)) {
            return true;
        }
        String text = readResource(META_SCHEMAS_PATH + uri.substring(RELEASE_BASE_URI.length()));
        if (text == null) {
            return false;
        }
        JsonObject schema = new JsonObject(text);
        if (register(schema) == null) {
            return false;
        }
        pending.add(schema);
        return true;
    }

    private String register(JsonObject schema) {
        String id = schema.getString("$id");
        if (id == null) {
            LOG.warn("Ignoring a bundled schema with no $id");
            return null;
        }
        if (registered.contains(id)) {
            return id;
        }
        try {
            repository.dereference(id, JsonSchema.of(schema.copy()));
            registered.add(id);
            documents.put(id, schema);
            return id;
        } catch (SchemaException e) {
            LOG.warn("Ignoring bundled schema [{}]: {}", id, e.getMessage());
            return null;
        }
    }

    private static Set<String> refs(Object node) {
        Set<String> refs = new HashSet<>();
        Deque<Object> nodes = new ArrayDeque<>(List.of(node));
        while (!nodes.isEmpty()) {
            Object current = nodes.poll();
            if (current instanceof JsonObject object) {
                if (object.getValue("$ref") instanceof String ref) {
                    refs.add(ref);
                }
                object.forEach(entry -> {
                    if (entry.getValue() != null) nodes.add(entry.getValue());
                });
            } else if (current instanceof JsonArray array) {
                array.forEach(value -> {
                    if (value != null) nodes.add(value);
                });
            }
        }
        return refs;
    }

    private static String pointer(String instanceLocation) {
        if (instanceLocation == null) {
            return "";
        }
        return instanceLocation.startsWith("#") ? instanceLocation.substring(1) : instanceLocation;
    }

    private static List<String> readLines(String resource) {
        String text = readResource(resource);
        if (text == null) {
            LOG.warn("No decorator Standards index on the classpath at {}", resource);
            return List.of();
        }
        return text.lines().map(String::trim).filter(line -> !line.isEmpty()).toList();
    }

    private static JsonObject readJson(String resource) {
        String text = readResource(resource);
        if (text == null) {
            LOG.error("Decorator Standard listed in files.txt is not on the classpath: {}", resource);
            return null;
        }
        return new JsonObject(text);
    }

    private static String readResource(String resource) {
        try (InputStream is = Thread.currentThread().getContextClassLoader().getResourceAsStream(resource)) {
            return is == null ? null : new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            LOG.error("Failed to read {}", resource, e);
            return null;
        }
    }
}
