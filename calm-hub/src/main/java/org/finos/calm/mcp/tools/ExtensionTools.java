package org.finos.calm.mcp.tools;

import io.quarkiverse.mcp.server.TextContent;
import io.quarkiverse.mcp.server.ToolManager;
import io.quarkiverse.mcp.server.ToolResponse;
import io.quarkus.runtime.StartupEvent;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.CurrentVertxRequest;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.Json;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.OutputUnit;
import io.vertx.json.schema.SchemaRepository;
import io.vertx.json.schema.Validator;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.interceptor.Interceptor;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.finos.calm.extensions.ExtensionManifestLoader;
import org.finos.calm.extensions.ExtensionProxyException;
import org.finos.calm.extensions.ExtensionProxyRequest;
import org.finos.calm.extensions.ExtensionProxyResponse;
import org.finos.calm.extensions.ExtensionProxyService;
import org.finos.calm.extensions.ExtensionRegistry;
import org.finos.calm.extensions.ExtensionRouteMatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Registers one MCP tool for each extension command at start up (ADR 0014). Each call goes through
 * {@link ExtensionProxyService}, so the scope, read-only, audit and limit rules of the REST proxy
 * apply. Tools are not hidden from callers who lack the scope: the proxy checks it on each call.
 */
@ApplicationScoped
public class ExtensionTools {

    private static final Logger logger = LoggerFactory.getLogger(ExtensionTools.class);
    private static final Pattern PATH_PARAM = Pattern.compile("\\{([^}]+)}");
    private static final String SCHEMA_BASE = "https://calm.finos.org/calm-hub/extensions/";
    private static final String RESULT = "result";
    // Keywords whose value is a schema or a list of schemas. Other keywords, also unknown ones such as x-example, are data.
    private static final Set<String> SCHEMA_KEYWORDS = Set.of("additionalProperties", "additionalItems", "items",
            "prefixItems", "contains", "propertyNames", "not", "if", "then", "else", "allOf", "anyOf", "oneOf",
            "unevaluatedItems", "unevaluatedProperties", "contentSchema");
    // Hub keeps these as booleans: clients read them, and some, such as strict function calling, require false.
    private static final Set<String> BOOLEAN_KEYWORDS = Set.of("additionalProperties", "unevaluatedProperties");
    // Keywords whose value maps names to schemas.
    private static final Set<String> SCHEMA_MAPS = Set.of("properties", "patternProperties", "$defs", "definitions",
            "dependentSchemas", "dependencies");
    // Refused in each object of a command schema, at any depth. Ajv in the SDK reads ids also under unknown keywords.
    // The $recursive keywords are 2019-09.
    private static final List<String> IDENTIFIER_KEYWORDS = List.of("$id", "$anchor", "$dynamicAnchor", "$dynamicRef",
            "$recursiveAnchor", "$recursiveRef");
    // Ajv in the SDK overflows its stack on a schema nested about 350 deep.
    static final int MAX_SCHEMA_DEPTH = 64;
    // The input check takes time in proportion to the argument size times the pattern size, so Hub limits both.
    static final int MAX_ARGUMENTS_BYTES = 1024 * 1024;
    // The Vert.x limit on the request line of a REST call (method, /api/calm/extensions/<id>/api, path, query and
    // HTTP/1.1), so that an MCP call cannot send a path and query that the same REST call cannot.
    static final int MAX_REQUEST_LINE_LENGTH = 4096;
    private static final String HTTP_VERSION = "HTTP/1.1";
    // Hub refuses these parts of a path, also a look-alike of /, \, ., %, @ or ; (ExtensionPaths.FORBIDDEN). The same
    // rule as @finos/calm-shared buildExtensionRequest. The test resource extensions-test/path-values.json ties them together.
    private static final Pattern REFUSED_PATH_VALUE = Pattern.compile("\\.\\.|[/\\\\%@\\x00-\\x1f\\x7f"
            + "\\u037e\\u2024-\\u2026\\u2044\\u2100\\u2101\\u2105\\u2106\\u2215\\u2216\\u29f5\\u29f8"
            + "\\ufe14\\ufe19\\ufe30\\ufe52\\ufe54\\ufe68\\ufe6a\\ufe6b\\uff05\\uff0e\\uff0f\\uff1b\\uff20\\uff3c]");
    private static final Pattern CONTROL_CHARACTER = Pattern.compile("[\\x00-\\x1f\\x7f]");
    private static final String PATH_VALUE_RULE = "must not be empty or ., or contain .., /, \\, %, @, a look-alike of /, "
            + "\\, ., %, @ or ;, a control character or a lone surrogate";
    private static final String QUERY_VALUE_RULE = "must not contain a control character or a lone surrogate";
    private static final String META_SCHEMA_BASE = "https://json-schema.org/draft/2020-12/";
    private static final String META_SCHEMA = META_SCHEMA_BASE + "schema";
    // Bundled in vertx-json-schema under this classpath folder.
    private static final String META_SCHEMA_PATH = "json-schema.org/draft/2020-12/";
    private static final List<String> META_SCHEMA_FILES = List.of("schema", "meta/core", "meta/applicator",
            "meta/unevaluated", "meta/validation", "meta/meta-data", "meta/format-annotation", "meta/content");
    private static final JsonSchemaOptions META_SCHEMA_OPTIONS = new JsonSchemaOptions()
            .setDraft(Draft.DRAFT202012)
            .setBaseUri(META_SCHEMA)
            .setOutputFormat(OutputFormat.Basic);
    static final SchemaRepository META_SCHEMAS = metaSchemas(META_SCHEMA_PATH);

    /** One command with what its handler needs. {@code routes} are all the routes of the extension. */
    record ExtensionTool(String name, String extensionId, String extensionName, String commandName,
                         ExtensionManifest.Command command, ExtensionManifest.Route route, InputSchema inputValidator,
                         List<ExtensionManifest.Route> routes) {

        boolean readOnly() {
            return "GET".equals(route.method()) || route.readOnly();
        }

        /** MCP requires an object output schema, so Hub wraps any other output in {@code result}. */
        boolean wrapsOutput() {
            return command.output() != null && !"object".equals(command.output().get("type"));
        }

        Map<String, Object> inputSchema() {
            return published(command.input());
        }

        Map<String, Object> outputSchema() {
            if (!wrapsOutput()) {
                return published(command.output());
            }
            Map<String, Object> result = new LinkedHashMap<>(command.output());
            Map<String, Object> schema = new LinkedHashMap<>();
            schema.put("type", "object");
            Object draft = result.remove("$schema");
            if (draft != null) {
                schema.put("$schema", draft);
            }
            // Its own $id keeps the local $refs of the output schema pointing into it. The TypeScript MCP SDK
            // overflows its stack on a subschema with both $id and $ref, but compiles the same ref in allOf.
            result.put("$id", outputSchemaId(extensionId, commandName));
            if (result.remove("$ref") instanceof String ref) {
                List<Object> allOf = new ArrayList<>(result.get("allOf") instanceof List<?> existing ? existing : List.of());
                allOf.add(Map.of("$ref", ref));
                result.put("allOf", allOf);
            }
            schema.put("properties", Map.of(RESULT, result));
            schema.put("required", List.of(RESULT));
            return published(schema);
        }
    }

    @Inject
    @ConfigProperty(name = "calm.mcp.enabled", defaultValue = "false")
    boolean mcpEnabled;

    @Inject
    ToolManager toolManager;

    @Inject
    ExtensionRegistry registry;

    @Inject
    ExtensionProxyService proxyService;

    @Inject
    SecurityIdentity identity;

    @ConfigProperty(name = "calm.audit.capture-source-ip", defaultValue = "false")
    boolean captureSourceIp;

    // The MCP HTTP transport sets the current request when it starts the request context of a call.
    @Inject
    CurrentVertxRequest currentRequest;

    SchemaRepository metaSchemas = META_SCHEMAS;

    // After ExtensionRegistry has loaded the manifests on the same event.
    void onStartup(@Observes @Priority(Interceptor.Priority.APPLICATION + 1000) StartupEvent event) {
        register();
    }

    void register() {
        if (!mcpEnabled) {
            return;
        }
        if (metaSchemas == null) {
            logger.error("CALM Hub registers no MCP tools for extension commands, because it cannot check their schemas");
            return;
        }
        register(tools(registry.available()));
    }

    void register(List<ExtensionTool> tools) {
        List<String> registered = new ArrayList<>();
        for (ExtensionTool tool : tools) {
            if (toolManager.getTool(tool.name()) != null) {
                logger.warn("Extension {} command '{}' has no MCP tool: a tool named {} already exists",
                        tool.extensionId(), tool.commandName(), tool.name());
                continue;
            }
            // A manifest must never stop Hub.
            try {
                ExtensionManifest.Command command = tool.command();
                ToolManager.ToolDefinition definition = toolManager.newTool(tool.name())
                        .setTitle(tool.extensionName() + ": " + tool.commandName())
                        .setDescription(command.description())
                        .setInputSchema(tool.inputSchema())
                        .setAnnotations(annotations(tool))
                        .setHandler(args -> call(tool, args.args()));
                if (command.output() != null) {
                    definition.setOutputSchema(tool.outputSchema());
                }
                definition.register();
                registered.add(tool.name());
            } catch (RuntimeException | Error e) {
                rethrowIfFatal(e);
                logger.warn("Extension {} command '{}' has no MCP tool: CALM Hub cannot register it: {}",
                        tool.extensionId(), tool.commandName(), e.toString());
                remove(tool);
            }
        }
        if (!registered.isEmpty()) {
            logger.info("Registered MCP tools for extension commands: {}", registered);
        }
    }

    // ToolManager adds the tool before its ToolAdded observers run, so a tool that an observer refuses stays listed.
    // register() checked that no other tool has this name.
    private void remove(ExtensionTool tool) {
        try {
            toolManager.removeTool(tool.name());
        } catch (RuntimeException | Error e) {
            rethrowIfFatal(e);
            logger.error("MCP tool {} may still be listed: CALM Hub cannot remove it: {}", tool.name(), e.toString());
        }
    }

    // A StackOverflowError comes from the command and leaves a clean stack. Other VM errors, such as an
    // OutOfMemoryError, are about the JVM, so Hub must not start as if it were healthy.
    static void rethrowIfFatal(Throwable e) {
        if (e instanceof VirtualMachineError fatal && !(e instanceof StackOverflowError)) {
            throw fatal;
        }
    }

    /**
     * The tools for the commands that this Hub can run, sorted by name. {@code tools/list} keeps the
     * registration order. A read-only Hub has already left out the commands of write routes.
     */
    static List<ExtensionTool> tools(List<ExtensionManifest> manifests) {
        List<ExtensionTool> tools = new ArrayList<>();
        for (ExtensionManifest manifest : manifests) {
            manifest.commands().forEach((name, command) -> {
                try {
                    ExtensionManifest.Route route = manifest.route(command.route())
                            .orElseThrow(() -> new IllegalStateException("it names route '" + command.route()
                                    + "', which is not declared"));
                    if (isInvalid(manifest.id(), name, "input", command.input(), ExtensionTools::inputSchemaError)
                            || isInvalid(manifest.id(), name, "output", command.output(), ExtensionTools::schemaError)) {
                        return;
                    }
                    tools.add(new ExtensionTool(ExtensionManifestLoader.toolName(manifest.id(), name), manifest.id(),
                            manifest.name(), name, command, route,
                            InputSchema.of(manifest.id(), name, published(command.input())), manifest.routes()));
                } catch (RuntimeException e) {
                    logger.warn("Extension {} command '{}' has no MCP tool: {}", manifest.id(), name, e.getMessage());
                } catch (Error e) {
                    // Such as a StackOverflowError on a deep schema. One command must not stop Hub or skip the others.
                    rethrowIfFatal(e);
                    logger.warn("Extension {} command '{}' has no MCP tool: CALM Hub cannot check it: {}", manifest.id(), name,
                            e.toString());
                }
            });
        }
        tools.sort(Comparator.comparing(ExtensionTool::name));
        return tools;
    }

    private static boolean isInvalid(String extensionId, String commandName, String kind, Map<String, Object> schema,
                                     Function<Map<String, Object>, String> check) {
        String error = schema == null ? null : check.apply(schema);
        if (error != null) {
            logger.warn("Extension {} command '{}' has no MCP tool: its {} schema is not in the JSON Schema 2020-12 subset "
                            + "that CALM Hub supports: {}",
                    extensionId, commandName, kind, error);
        }
        return error != null;
    }

    static String schemaError(Map<String, Object> schema) {
        return schemaError(schema, META_SCHEMAS);
    }

    /**
     * The error of a command schema that names the value to fix, or null. The manifest check does not
     * check command schemas. One schema that an MCP client cannot compile makes TypeScript SDK clients
     * lose every tool, so Hub accepts only a subset of 2020-12: a limited depth, no schema identifiers,
     * only local JSON Pointer refs, and patterns that are valid in both ECMA-262 and Java.
     */
    static String schemaError(Map<String, Object> schema, SchemaRepository metaSchemas) {
        // Before the meta-schema check, which compiles each pattern with java.util.regex.
        String error = structureError(schema, "", 1);
        error = error != null ? error : firstError(schema, "", (subschema, pointer) -> {
            String own = dialectError(subschema, pointer);
            return own != null ? own : patternError(subschema, pointer);
        });
        if (error != null) {
            return error;
        }
        if (metaSchemas == null) {
            return "CALM Hub cannot load the JSON Schema 2020-12 meta-schema";
        }
        OutputUnit result;
        try {
            result = metaSchemas.validator(META_SCHEMA, META_SCHEMA_OPTIONS)
                    .validate(new JsonObject(new LinkedHashMap<>(schema)).copy());
        } catch (RuntimeException e) {
            return "CALM Hub cannot check it: " + e;
        }
        if (!Boolean.TRUE.equals(result.getValid())) {
            // The deepest error names the value to fix. The others say only that a parent does not match.
            OutputUnit deepest = result.getErrors() == null ? result : result.getErrors().stream()
                    .max(Comparator.comparingInt(unit -> location(unit).length()))
                    .orElse(result);
            return at(location(deepest)) + ": " + deepest.getError();
        }
        error = firstError(schema, "", (subschema, pointer) -> refError(schema, subschema, pointer));
        return error != null ? error : refDepthError(schema);
    }

    /**
     * {@link #schemaError}, and also the error of a pattern that Hub cannot match in linear time, or
     * of a schema for which {@link InputSchema} would change the meaning.
     */
    static String inputSchemaError(Map<String, Object> schema) {
        String error = schemaError(schema);
        return error != null ? error : linearPatternError(schema);
    }

    // vertx checks these formats with java.util.regex in linear time; TestExtensionToolsShould times each on 1 MB.
    // The others can backtrack (url) or compile caller input (regex).
    static final Set<String> LINEAR_FORMATS = Set.of("date", "time", "date-time", "duration", "email", "hostname",
            "ipv4", "ipv6", "uuid");

    private static String linearPatternError(Map<String, Object> root) {
        boolean[] patternProperties = {false};
        String error = firstError(root, "", (subschema, pointer) -> {
            if (subschema.get("format") instanceof String format && !LINEAR_FORMATS.contains(format)) {
                return pointer + "/format: '" + shortened(format) + "' cannot be in an input schema: CALM Hub can check only "
                        + String.join(", ", new TreeSet<>(LINEAR_FORMATS)) + " in linear time";
            }
            if (subschema.get("pattern") instanceof String pattern) {
                String reason = EcmaRegex.linearError(pattern);
                if (reason != null) {
                    return pointer + "/pattern: '" + shortened(pattern) + "' cannot be in an input schema: " + reason;
                }
            }
            if (subschema.get("patternProperties") instanceof Map<?, ?> named) {
                patternProperties[0] = true;
                for (Object key : named.keySet()) {
                    String reason = EcmaRegex.linearError(String.valueOf(key));
                    if (reason != null) {
                        return pointer + "/patternProperties: the key '" + shortened(String.valueOf(key))
                                + "' cannot be in an input schema: " + reason;
                    }
                }
            }
            return null;
        });
        if (error != null || !patternProperties[0]) {
            return error;
        }
        // Hub checks patternProperties outside vertx, so vertx cannot tell which properties they evaluate.
        return firstError(root, "", (subschema, pointer) -> {
            if (subschema.containsKey("unevaluatedProperties")) {
                return pointer + "/unevaluatedProperties: CALM Hub does not support unevaluatedProperties in an input "
                        + "schema that has patternProperties";
            }
            if (subschema.get("$ref") instanceof String ref && throughPatternProperties(root, localPointer(ref))) {
                return pointer + "/$ref: '" + shortened(ref) + "' points into patternProperties, or into the "
                        + "additionalProperties next to them, which CALM Hub does not support in an input schema";
            }
            return null;
        });
    }

    // Hub moves these subschemas when it checks the input.
    private static boolean throughPatternProperties(Map<String, Object> root, String pointer) {
        if (pointer == null) {
            return false;
        }
        Object value = root;
        for (String token : pointer.isEmpty() ? new String[0] : pointer.substring(1).split("/", -1)) {
            String keyword = unescape(token);
            if (!(value instanceof Map<?, ?> schema)) {
                return false;
            }
            if (keyword.equals("patternProperties")
                    || (keyword.equals("additionalProperties") && schema.containsKey("patternProperties"))) {
                return true;
            }
            value = schema.get(keyword);
        }
        return false;
    }

    /**
     * The error of a schema that is nested more than {@link #MAX_SCHEMA_DEPTH} deep when each
     * {@code $ref} is replaced by its target, as Ajv compiles it. A ref that leads back to a schema
     * that the walk is in adds no depth: Ajv compiles that schema only once.
     */
    private static String refDepthError(Map<String, Object> root) {
        try {
            height(root, root, "", 1, new IdentityHashMap<>(), Collections.newSetFromMap(new IdentityHashMap<>()));
            return null;
        } catch (TooDeep e) {
            return at(e.pointer) + ": the schema is nested more than " + MAX_SCHEMA_DEPTH + " objects and arrays deep "
                    + "when its $refs are followed, which CALM Hub does not support";
        }
    }

    // The number of levels from value down to its deepest value, with each $ref target one level below the ref.
    private static int height(Map<String, Object> root, Object value, String pointer, int depth,
                              Map<Object, Integer> heights, Set<Object> open) {
        if (!(value instanceof Map || value instanceof List)) {
            return 0;
        }
        Integer known = heights.get(value);
        if (depth > MAX_SCHEMA_DEPTH || (known != null && depth + known - 1 > MAX_SCHEMA_DEPTH)) {
            throw new TooDeep(pointer);
        }
        if (known != null || !open.add(value)) {
            return known == null ? 0 : known;
        }
        int below = 0;
        if (value instanceof List<?> list) {
            for (int i = 0; i < list.size(); i++) {
                below = Math.max(below, height(root, list.get(i), pointer + "/" + i, depth + 1, heights, open));
            }
        } else {
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                String here = pointer + "/" + escape(String.valueOf(entry.getKey()));
                below = Math.max(below, height(root, entry.getValue(), here, depth + 1, heights, open));
            }
            // refError has checked that each ref is a local pointer to a subschema.
            if (((Map<?, ?>) value).get("$ref") instanceof String ref && localPointer(ref) instanceof String target) {
                below = Math.max(below, height(root, subschema(root, target), target, depth + 1, heights, open));
            }
        }
        open.remove(value);
        heights.put(value, below + 1);
        return below + 1;
    }

    private static final class TooDeep extends RuntimeException {
        private final String pointer;

        TooDeep(String pointer) {
            super(null, null, false, false);
            this.pointer = pointer;
        }
    }

    private static String location(OutputUnit error) {
        return error.getInstanceLocation() == null ? "" : error.getInstanceLocation().replaceFirst("^#", "");
    }

    private static String at(String pointer) {
        return pointer.isEmpty() ? "/" : pointer;
    }

    // Hub checks input as 2020-12 and MCP clients assume it, so another dialect would change the meaning.
    private static String dialectError(Map<String, Object> schema, String pointer) {
        Object dialect = schema.get("$schema");
        if (dialect == null || META_SCHEMA.equals(dialect) || (META_SCHEMA + "#").equals(dialect)) {
            return null;
        }
        return at(pointer) + ": it declares the $schema '" + dialect + "', but CALM Hub supports only JSON Schema 2020-12 ("
                + META_SCHEMA + ")";
    }

    /**
     * The error of a value nested deeper than {@link #MAX_SCHEMA_DEPTH} objects and arrays, or of an
     * identifier keyword as a key of any object. This walks all values, also those of unknown keywords,
     * {@code const} and {@code enum}, and the property maps, because Ajv reads ids in some of them. Each
     * kind of {@code $id} or anchor that the SDK could not compile broke every client.
     */
    private static String structureError(Object value, String pointer, int depth) {
        if (!(value instanceof Map || value instanceof List)) {
            return null;
        }
        if (depth > MAX_SCHEMA_DEPTH) {
            return at(pointer) + ": the schema is nested more than " + MAX_SCHEMA_DEPTH
                    + " objects and arrays deep, which CALM Hub does not support";
        }
        if (value instanceof List<?> list) {
            for (int i = 0; i < list.size(); i++) {
                String error = structureError(list.get(i), pointer + "/" + i, depth + 1);
                if (error != null) {
                    return error;
                }
            }
            return null;
        }
        for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
            String key = String.valueOf(entry.getKey());
            String here = pointer + "/" + escape(key);
            if (IDENTIFIER_KEYWORDS.contains(key)) {
                return here + ": CALM Hub does not support " + key + " in command schemas, at any depth or under any "
                        + "keyword. Use a $ref with a JSON Pointer, such as #/$defs/name";
            }
            String error = structureError(entry.getValue(), here, depth + 1);
            if (error != null) {
                return error;
            }
        }
        return null;
    }

    /** The error of a {@code $ref} that is not a local JSON Pointer to a subschema, or that leads only to a loop of refs. */
    private static String refError(Map<String, Object> root, Map<String, Object> schema, String pointer) {
        if (!(schema.get("$ref") instanceof String ref)) {
            return null;
        }
        // Java decodes the fragment before it splits it, and Ajv after. Ajv also throws on bad UTF-8.
        if (ref.contains("%")) {
            return pointer + "/$ref: '" + shortened(ref) + "' has a %, which CALM Hub does not support in a $ref. "
                    + "Use $defs names that need no percent-encoding";
        }
        String fragment = localPointer(ref);
        if (fragment == null) {
            return pointer + "/$ref: '" + shortened(ref) + "' is not a local JSON Pointer such as #/$defs/name. CALM Hub and MCP "
                    + "clients do not fetch remote schemas";
        }
        // Ajv in the SDK overflows its stack on a loop.
        Set<Object> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        Object target = subschema(root, fragment);
        while (target instanceof Map<?, ?> map && map.get("$ref") instanceof String next && localPointer(next) != null) {
            if (!seen.add(target)) {
                return pointer + "/$ref: '" + shortened(ref) + "' leads only to a loop of $refs";
            }
            target = subschema(root, localPointer(next));
        }
        return target == null ? pointer + "/$ref: '" + shortened(ref) + "' points to no subschema" : null;
    }

    // The JSON Pointer of a ref such as #/$defs/name, or null.
    private static String localPointer(String ref) {
        try {
            String fragment = ref.startsWith("#") ? new URI(ref).getFragment() : null;
            return fragment != null && (fragment.isEmpty() || fragment.startsWith("/")) ? fragment : null;
        } catch (URISyntaxException e) {
            return null;
        }
    }

    /** The subschema at a JSON Pointer from the root, or null if the pointer names no subschema. */
    private static Object subschema(Object root, String pointer) {
        Object value = root;
        String[] tokens = pointer.isEmpty() ? new String[0] : pointer.substring(1).split("/", -1);
        int i = 0;
        while (i < tokens.length) {
            if (!(value instanceof Map<?, ?> schema)) {
                return null;
            }
            String keyword = unescape(tokens[i++]);
            Object child = schema.get(keyword);
            boolean named = SCHEMA_MAPS.contains(keyword);
            if (named || (SCHEMA_KEYWORDS.contains(keyword) && child instanceof List)) {
                if (i == tokens.length) {
                    return null;
                }
                String key = unescape(tokens[i++]);
                if (named) {
                    child = child instanceof Map<?, ?> map ? map.get(key) : null;
                } else {
                    List<?> list = (List<?>) child;
                    child = key.matches("0|[1-9][0-9]{0,8}") && Integer.parseInt(key) < list.size()
                            ? list.get(Integer.parseInt(key)) : null;
                }
            } else if (!SCHEMA_KEYWORDS.contains(keyword)) {
                return null;
            }
            if (!(child instanceof Map || child instanceof Boolean)) {
                return null;
            }
            value = child;
        }
        return value;
    }

    private static String unescape(String token) {
        return token.replace("~1", "/").replace("~0", "~");
    }

    // java.util.regex, which the meta-schema check uses for format regex, accepts syntax that Ajv in the SDK refuses.
    private static String patternError(Map<String, Object> schema, String pointer) {
        if (schema.get("pattern") instanceof String pattern) {
            String error = EcmaRegex.error(pattern);
            if (error != null) {
                return pointer + "/pattern: '" + shortened(pattern) + "' is not an ECMA-262 regular expression: " + error;
            }
        }
        if (schema.get("patternProperties") instanceof Map<?, ?> patterns) {
            for (Object key : patterns.keySet()) {
                String error = EcmaRegex.error(String.valueOf(key));
                if (error != null) {
                    return pointer + "/patternProperties: the key '" + shortened(String.valueOf(key))
                            + "' is not an ECMA-262 regular expression: " + error;
                }
            }
        }
        return null;
    }

    // The warnings quote patterns and refs, which can be long.
    private static String shortened(String value) {
        return value.codePointCount(0, value.length()) <= 60 ? value : value.substring(0, value.offsetByCodePoints(0, 60)) + "...";
    }

    /**
     * The first error of {@code check} on a schema and its subschemas, or the location of a subschema
     * that is not an object or a boolean.
     */
    @SuppressWarnings("unchecked")
    private static String firstError(Object value, String pointer, BiFunction<Map<String, Object>, String, String> check) {
        if (value instanceof Boolean) {
            return null;
        }
        if (!(value instanceof Map<?, ?> map)) {
            return at(pointer) + ": the value must be a schema (an object or a boolean)";
        }
        String own = check.apply((Map<String, Object>) map, pointer);
        if (own != null) {
            return own;
        }
        for (Map.Entry<String, Object> entry : ((Map<String, Object>) map).entrySet()) {
            String keyword = entry.getKey();
            String here = pointer + "/" + escape(keyword);
            String error = null;
            // A dependencies value can also be a list of names.
            if (SCHEMA_MAPS.contains(keyword) && entry.getValue() instanceof Map<?, ?> named) {
                for (Map.Entry<?, ?> subschema : named.entrySet()) {
                    if (error == null && !(keyword.equals("dependencies") && subschema.getValue() instanceof List)) {
                        error = firstError(subschema.getValue(), here + "/" + escape(String.valueOf(subschema.getKey())), check);
                    }
                }
            } else if (SCHEMA_KEYWORDS.contains(keyword) && entry.getValue() instanceof List<?> list) {
                for (int i = 0; i < list.size() && error == null; i++) {
                    error = firstError(list.get(i), here + "/" + i, check);
                }
            } else if (SCHEMA_KEYWORDS.contains(keyword)) {
                error = firstError(entry.getValue(), here, check);
            }
            if (error != null) {
                return error;
            }
        }
        return null;
    }

    private static String escape(String token) {
        return token.replace("~", "~0").replace("/", "~1");
    }

    // Null if the meta-schemas that vertx-json-schema bundles cannot be loaded. Hub then starts with no extension tools.
    static SchemaRepository metaSchemas(String path) {
        try {
            SchemaRepository repository = SchemaRepository.create(META_SCHEMA_OPTIONS);
            ClassLoader loader = ExtensionTools.class.getClassLoader();
            for (String file : META_SCHEMA_FILES) {
                try (InputStream in = loader.getResourceAsStream(path + file)) {
                    if (in == null) {
                        throw new IOException("there is no resource " + path + file);
                    }
                    repository.dereference(META_SCHEMA_BASE + file,
                            JsonSchema.of(new JsonObject(new String(in.readAllBytes(), StandardCharsets.UTF_8))));
                }
            }
            return repository;
        } catch (IOException | RuntimeException e) {
            logger.error("CALM Hub cannot load the JSON Schema 2020-12 meta-schema: {}", e.toString());
            return null;
        }
    }

    static ToolManager.ToolAnnotations annotations(ExtensionTool tool) {
        boolean readOnly = tool.readOnly();
        ExtensionManifest.Command command = tool.command();
        // With no hint in the manifest, use the MCP defaults: a write may be destructive and is not idempotent.
        boolean destructive = !readOnly && (command.destructive() == null || command.destructive());
        boolean idempotent = readOnly || Boolean.TRUE.equals(command.idempotent());
        return new ToolManager.ToolAnnotations(null, readOnly, destructive, idempotent, true);
    }

    ToolResponse call(ExtensionTool tool, Map<String, Object> args) {
        Optional<ToolResponse> err = McpValidationHelper.firstError(
                () -> McpValidationHelper.checkEnabled(mcpEnabled));
        if (err.isPresent()) return err.get();

        JsonObject input;
        ExtensionProxyRequest request;
        try {
            input = new JsonObject(args == null ? new LinkedHashMap<>() : new LinkedHashMap<>(args)).copy();
            if (input.toBuffer().length() > MAX_ARGUMENTS_BYTES) {
                return ToolResponse.error("Error: The arguments are larger than " + MAX_ARGUMENTS_BYTES + " bytes of JSON.");
            }
            // The mapping errors come before the scope check: they need no scope, and they cost little.
            request = request(tool, input, sourceIp());
        } catch (IllegalArgumentException e) {
            return ToolResponse.error("Error: " + e.getMessage());
        } catch (StackOverflowError e) {
            // The copy, the size check and the request recurse for each level of the arguments.
            return ToolResponse.error("Error: The arguments are nested too deeply.");
        }
        try {
            // The input check can be slow, so a caller with no scope must not reach it.
            proxyService.checkAccess(identity, request);
            String inputError = validate(tool, input);
            if (inputError != null) {
                return ToolResponse.error(inputError);
            }
            return response(tool, proxyService.call(identity, request));
        } catch (ExtensionProxyException e) {
            return ToolResponse.error("Error: " + e.getMessage());
        }
    }

    // The audit log has the X-Forwarded-For header of the MCP request, as for a REST call.
    private String sourceIp() {
        if (!captureSourceIp || currentRequest == null) {
            return null;
        }
        RoutingContext current = currentRequest.getCurrent();
        return current == null ? null : current.request().getHeader("X-Forwarded-For");
    }

    private static String validate(ExtensionTool tool, JsonObject input) {
        OutputUnit result;
        try {
            result = tool.inputValidator().validate(input);
        } catch (RuntimeException | StackOverflowError e) {
            // vertx-json-schema throws on some valid schemas. Its format checks use java.util.regex, which recurses
            // for each repeat, and it recurses for each level of the input, so a long or deep argument can overflow the stack.
            logger.warn("Cannot check the input of MCP tool {}: {}", tool.name(), e.toString());
            return "Error: CALM Hub cannot check the input against the schema of this command.";
        }
        if (Boolean.TRUE.equals(result.getValid())) {
            return null;
        }
        List<OutputUnit> errors = result.getErrors() == null || result.getErrors().isEmpty() ? List.of(result) : result.getErrors();
        StringBuilder sb = new StringBuilder("Error: The input does not match the schema of this command:");
        for (OutputUnit error : errors.subList(0, Math.min(errors.size(), SchemaValidationLimits.MAX_ERRORS))) {
            String location = error.getInstanceLocation() == null ? "" : error.getInstanceLocation().replaceFirst("^#", "");
            sb.append("\n- ").append(location.isEmpty() ? "/" : location).append(": ").append(error.getError());
        }
        if (errors.size() > SchemaValidationLimits.MAX_ERRORS) {
            sb.append("\n- and ").append(errors.size() - SchemaValidationLimits.MAX_ERRORS).append(" more");
        }
        return sb.toString();
    }

    /**
     * The ADR 0012 mapping, as the CLI does it: input properties that match a {@code {param}} fill
     * the path. The rest go to the query for GET and DELETE, and to the JSON body for other methods.
     */
    static ExtensionProxyRequest request(ExtensionTool tool, JsonObject input) {
        return request(tool, input, null);
    }

    /** {@code sourceIp} is for the audit log, and can be null. */
    static ExtensionProxyRequest request(ExtensionTool tool, JsonObject input, String sourceIp) {
        ExtensionManifest.Route route = tool.route();
        Map<String, Object> rest = new LinkedHashMap<>(input.getMap());
        Matcher matcher = PATH_PARAM.matcher(route.path());
        StringBuilder path = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            Object value = input.getValue(name);
            if (value == null) {
                throw new IllegalArgumentException("Input property '" + name + "' is required, because it fills the path "
                        + route.path());
            }
            if (!(value instanceof String || value instanceof Number || value instanceof Boolean)) {
                throw new IllegalArgumentException("Input property '" + name + "' must be a string, number or boolean, "
                        + "because it fills the path " + route.path());
            }
            String text = scalarText(value);
            if (text.isEmpty() || text.equals(".") || REFUSED_PATH_VALUE.matcher(text).find() || !wellFormed(text)) {
                throw new IllegalArgumentException("Input property '" + name + "' " + PATH_VALUE_RULE
                        + ", because it fills the path " + route.path());
            }
            rest.remove(name);
            matcher.appendReplacement(path, Matcher.quoteReplacement(encodePathValue(text)));
        }
        matcher.appendTail(path);
        String method = route.method();
        checkMatchedRoute(tool, method, path.toString());

        boolean queryMethod = "GET".equals(method) || "DELETE".equals(method);
        String query = null;
        if (queryMethod) {
            List<String> parameters = new ArrayList<>();
            rest.forEach((name, value) -> queryValues(value).forEach(v -> {
                // Hub refuses an encoded control character in a query, with a message that does not name the property.
                if (!isQueryText(name) || !isQueryText(v)) {
                    throw new IllegalArgumentException("Input property '" + name + "' " + QUERY_VALUE_RULE
                            + ", because it goes in the query");
                }
                parameters.add(encodeQueryText(name) + "=" + encodeQueryText(v));
            }));
            query = parameters.isEmpty() ? null : String.join("&", parameters);
        }
        int requestLine = method.length() + 1 + proxyPathLength(tool.extensionId()) + path.length()
                + (query == null ? 0 : query.length() + 1) + 1 + HTTP_VERSION.length();
        if (requestLine > MAX_REQUEST_LINE_LENGTH) {
            throw new IllegalArgumentException("The path and query are too long: the request line of the same REST call "
                    + "would be longer than " + MAX_REQUEST_LINE_LENGTH + " characters.");
        }
        if (queryMethod) {
            return new ExtensionProxyRequest(tool.extensionId(), method, path.toString(), query, null, null, null, null,
                    null, sourceIp, null);
        }
        byte[] body = new JsonObject(rest).encode().getBytes(StandardCharsets.UTF_8);
        return new ExtensionProxyRequest(tool.extensionId(), method, path.toString(), null, "application/json", null,
                null, null, null, sourceIp, new ByteArrayInputStream(body));
    }

    /**
     * A 2xx reply is the tool result. A command with an object output schema must reply with a JSON
     * object. Any other output schema is wrapped, so the reply can be any JSON value.
     */
    static ToolResponse response(ExtensionTool tool, ExtensionProxyResponse reply) {
        String body = new String(reply.body(), StandardCharsets.UTF_8);
        if (reply.status() >= 300) {
            return ToolResponse.error("Error: The extension replied with status " + reply.status()
                    + (body.isBlank() ? "." : ": " + body));
        }
        if (tool.command().output() == null) {
            return ToolResponse.success(body);
        }
        if (tool.wrapsOutput()) {
            try {
                Object value = Json.decodeValue(body);
                Map<String, Object> structured = new LinkedHashMap<>();
                structured.put(RESULT, value instanceof JsonObject object ? object.getMap()
                        : value instanceof JsonArray array ? array.getList() : value);
                return new ToolResponse(false, List.of(new TextContent(Json.encode(structured))), structured, null);
            } catch (DecodeException e) {
                logger.warn("Extension {} command {} replied with no JSON, but declares an output schema",
                        tool.extensionId(), tool.commandName());
                return ToolResponse.error("Error: The extension reply is not the JSON that this command declares.");
            }
        }
        try {
            // Clients that do not read structuredContent get the same JSON as text.
            return new ToolResponse(false, List.of(new TextContent(body)), new JsonObject(body).getMap(), null);
        } catch (DecodeException | ClassCastException e) {
            logger.warn("Extension {} command {} replied with no JSON object, but declares an output schema",
                    tool.extensionId(), tool.commandName());
            return ToolResponse.error("Error: The extension reply is not the JSON object that this command declares.");
        }
    }

    /**
     * The proxy matches the route with the most literal segments, so a value that equals a literal of
     * another route, such as {@code admin} for {@code /services/{service}} next to {@code /services/admin},
     * would call that route. A tool calls only the route of its command.
     */
    private static void checkMatchedRoute(ExtensionTool tool, String method, String path) {
        ExtensionManifest.Route route = tool.route();
        int parameters = pathParameterCount(route.path());
        for (ExtensionManifest.Route other : tool.routes()) {
            if (!other.id().equals(route.id()) && other.method().equals(method)
                    && pathParameterCount(other.path()) < parameters
                    && ExtensionRouteMatcher.parameters(other.path(), path).isPresent()) {
                throw new IllegalArgumentException("The input fills the path " + route.path() + " so that it matches route '"
                        + other.id() + "', not route '" + route.id() + "' of this command.");
            }
        }
    }

    private static int pathParameterCount(String path) {
        return (int) PATH_PARAM.matcher(path).results().count();
    }

    // The length of /api/calm/extensions/<id>/api. An extension id needs no encoding.
    private static int proxyPathLength(String extensionId) {
        return "/api/calm/extensions/".length() + extensionId.length() + "/api".length();
    }

    private static boolean isQueryText(String value) {
        return wellFormed(value) && !CONTROL_CHARACTER.matcher(value).find();
    }

    // UTF-8 has no form for a lone surrogate: getBytes would send it as ?.
    private static boolean wellFormed(String value) {
        return StandardCharsets.UTF_8.newEncoder().canEncode(value);
    }

    /**
     * A number in plain notation with no trailing zeros, as the shared client writes it, so that both fill a
     * path or query with the same text: {@code 1.0} gives {@code 1}, and {@code 1e21} gives
     * {@code 1000000000000000000000}.
     */
    static String scalarText(Object value) {
        if (value instanceof Double || value instanceof Float) {
            return new BigDecimal(value.toString()).stripTrailingZeros().toPlainString();
        }
        if (value instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros().toPlainString();
        }
        return String.valueOf(value);
    }

    private static List<String> queryValues(Object value) {
        if (value instanceof JsonArray array) {
            return array.stream().flatMap(item -> queryValues(item).stream()).toList();
        }
        if (value instanceof List<?> list) {
            return list.stream().flatMap(item -> queryValues(item).stream()).toList();
        }
        if (value instanceof String || value instanceof Number || value instanceof Boolean) {
            return List.of(scalarText(value));
        }
        // An object or null is sent as JSON.
        return List.of(Json.encode(value));
    }

    /**
     * Encodes a path value as encodeURIComponent in the shared client does, so that both clients send, and Hub signs,
     * the same path for one input. It leaves the RFC 3986 unreserved characters and {@code !*'()} as they are, so a
     * value cannot add a path segment.
     */
    static String encodePathValue(String value) {
        return encode(value, "-._~!*'()", false);
    }

    /** Encodes a query name or value as URLSearchParams in the shared client does: a space becomes {@code +}. */
    static String encodeQueryText(String value) {
        return encode(value, "*-._", true);
    }

    private static String encode(String value, String unencoded, boolean plusForSpace) {
        StringBuilder sb = new StringBuilder();
        for (byte b : value.getBytes(StandardCharsets.UTF_8)) {
            int c = b & 0xff;
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || unencoded.indexOf(c) >= 0) {
                sb.append((char) c);
            } else if (c == ' ' && plusForSpace) {
                sb.append('+');
            } else {
                sb.append('%').append(Character.toUpperCase(Character.forDigit(c >> 4, 16)))
                        .append(Character.toUpperCase(Character.forDigit(c & 0xf, 16)));
            }
        }
        return sb.toString();
    }

    static String inputSchemaId(String extensionId, String commandName) {
        return SCHEMA_BASE + extensionId + "/commands/" + commandName + "/input.json";
    }

    static String outputSchemaId(String extensionId, String commandName) {
        return SCHEMA_BASE + extensionId + "/commands/" + commandName + "/output.json";
    }

    /**
     * The schema that Hub publishes, with the same meaning. Boolean subschemas become objects: the
     * Quarkus MCP server and the SDK clients require an object for each property.
     */
    static Map<String, Object> published(Map<String, Object> schema) {
        return mapSubschemas(schema, ExtensionTools::published);
    }

    /**
     * A copy of a schema with {@code f} applied to each direct subschema, a boolean one in its object
     * form, except for {@link #BOOLEAN_KEYWORDS}. The values of other keywords, also unknown ones, are
     * data and stay as they are.
     */
    private static Map<String, Object> mapSubschemas(Map<String, Object> schema, UnaryOperator<Map<String, Object>> f) {
        Map<String, Object> copy = new LinkedHashMap<>();
        schema.forEach((keyword, value) -> {
            if (SCHEMA_MAPS.contains(keyword) && value instanceof Map<?, ?> named) {
                Map<String, Object> mapped = new LinkedHashMap<>();
                named.forEach((name, subschema) -> mapped.put(String.valueOf(name), mapSubschema(subschema, f)));
                copy.put(keyword, mapped);
            } else if (SCHEMA_KEYWORDS.contains(keyword) && !(value instanceof Boolean && BOOLEAN_KEYWORDS.contains(keyword))) {
                copy.put(keyword, value instanceof List<?> list
                        ? list.stream().map(item -> mapSubschema(item, f)).toList()
                        : mapSubschema(value, f));
            } else {
                copy.put(keyword, value);
            }
        });
        return copy;
    }

    // A boolean schema and its object form have the same meaning.
    @SuppressWarnings("unchecked")
    private static Object mapSubschema(Object value, UnaryOperator<Map<String, Object>> f) {
        if (value instanceof Boolean accept) {
            return f.apply(accept ? Map.of() : Map.of("not", Map.of()));
        }
        if (value instanceof Map<?, ?> map) {
            return f.apply((Map<String, Object>) map);
        }
        return value;
    }

    /**
     * MCP servers do not check arguments against the input schema, so Hub does. Local {@code $ref}s
     * resolve only once the schema is in a repository.
     *
     * <p>java.util.regex can take hours on some valid patterns, so vertx gets a copy of the schema with
     * no patterns. Each {@code pattern} becomes a {@code format} in an added {@code allOf} entry, which
     * Hub checks with RE2J in linear time. Each {@code patternProperties}, with the
     * {@code additionalProperties} next to it, becomes such a format on the object.
     * {@link #linearPatternError} refuses the schemas for which this changes the meaning.
     */
    record InputSchema(SchemaRepository repository, String id, JsonSchemaOptions options) {

        static InputSchema of(String extensionId, String commandName, Map<String, Object> input) {
            try {
                String id = inputSchemaId(extensionId, commandName);
                JsonSchemaOptions options = new JsonSchemaOptions()
                        .setDraft(Draft.DRAFT202012)
                        .setBaseUri(id)
                        .setOutputFormat(OutputFormat.Basic);
                LinearPatterns patterns = new LinearPatterns(options);
                Map<String, Object> copy = patterns.copy(input);
                patterns.addDefinitions(copy);
                SchemaRepository repository = SchemaRepository.create(options, patterns::error);
                repository.dereference(id, JsonSchema.of(new JsonObject(copy).copy()));
                patterns.compile(repository);
                return new InputSchema(repository, id, options);
            } catch (RuntimeException e) {
                throw new IllegalStateException("CALM Hub cannot read its input schema: " + e.getMessage(), e);
            }
        }

        OutputUnit validate(JsonObject instance) {
            return repository.validator(id, options).validate(instance);
        }
    }

    /** The patterns of one input schema, which Hub matches with RE2J through vertx {@code format} checks. */
    static final class LinearPatterns {

        // A user format can never have this prefix, because it is new for each schema.
        private final String prefix = "calm-hub-" + UUID.randomUUID() + "-";
        private final JsonSchemaOptions options;
        private final List<Function<Object, String>> checks = new ArrayList<>();
        private final List<Map<String, Object>> definitions = new ArrayList<>();
        private final List<String> definitionNames = new ArrayList<>();
        private final List<Validator> validators = new ArrayList<>();

        LinearPatterns(JsonSchemaOptions options) {
            this.options = options;
        }

        /** A copy of a published schema with no pattern keywords. */
        Map<String, Object> copy(Map<String, Object> schema) {
            Map<String, Object> copy = mapSubschemas(schema, this::copy);
            List<Object> added = new ArrayList<>();
            if (copy.remove("pattern") instanceof String pattern) {
                added.add(format(pattern(pattern)));
            }
            if (copy.get("patternProperties") instanceof Map<?, ?> named) {
                copy.remove("patternProperties");
                Object additional = copy.remove("additionalProperties");
                Set<String> properties = copy.get("properties") instanceof Map<?, ?> map
                        ? map.keySet().stream().map(String::valueOf).collect(Collectors.toSet()) : Set.of();
                List<Map.Entry<com.google.re2j.Pattern, Integer>> entries = new ArrayList<>();
                named.forEach((key, subschema) -> entries.add(Map.entry(EcmaRegex.linear(String.valueOf(key)),
                        definition(asMap(subschema)))));
                Integer additionalIndex = additional instanceof Map<?, ?> map ? definition(asMap(map)) : null;
                added.add(format(patternProperties(entries, properties, additional, additionalIndex)));
            }
            if (!added.isEmpty()) {
                List<Object> allOf = new ArrayList<>(copy.get("allOf") instanceof List<?> existing ? existing : List.of());
                allOf.addAll(added);
                copy.put("allOf", allOf);
            }
            return copy;
        }

        @SuppressWarnings("unchecked")
        private static Map<String, Object> asMap(Object subschema) {
            return (Map<String, Object>) subschema;
        }

        private Map<String, Object> format(Function<Object, String> check) {
            checks.add(check);
            return Map.of("format", prefix + (checks.size() - 1));
        }

        private static Function<Object, String> pattern(String pattern) {
            com.google.re2j.Pattern regex = EcmaRegex.linear(pattern);
            return instance -> instance instanceof String text && !regex.matcher(text).find()
                    ? "String does not match pattern" : null;
        }

        private Function<Object, String> patternProperties(List<Map.Entry<com.google.re2j.Pattern, Integer>> entries,
                                                           Set<String> properties, Object additional,
                                                           Integer additionalIndex) {
            return instance -> {
                if (!(instance instanceof JsonObject object)) {
                    return null;
                }
                for (String key : object.fieldNames()) {
                    boolean matched = false;
                    for (Map.Entry<com.google.re2j.Pattern, Integer> entry : entries) {
                        if (entry.getKey().matcher(key).find()) {
                            matched = true;
                            String error = error(validators.get(entry.getValue()), object.getValue(key));
                            if (error != null) {
                                return "Property \"" + key + "\" matches pattern \"" + entry.getKey().pattern()
                                        + "\" but does not match associated schema: " + error;
                            }
                        }
                    }
                    if (matched || properties.contains(key) || additional == null || Boolean.TRUE.equals(additional)) {
                        continue;
                    }
                    String error = additionalIndex == null ? "it is not allowed"
                            : error(validators.get(additionalIndex), object.getValue(key));
                    if (error != null) {
                        return "Property \"" + key + "\" does not match additional properties schema: " + error;
                    }
                }
                return null;
            };
        }

        private static String error(Validator validator, Object value) {
            OutputUnit result = validator.validate(value);
            if (Boolean.TRUE.equals(result.getValid())) {
                return null;
            }
            List<OutputUnit> errors = result.getErrors() == null || result.getErrors().isEmpty()
                    ? List.of(result) : result.getErrors();
            // The last error is the deepest.
            return errors.get(errors.size() - 1).getError();
        }

        private int definition(Map<String, Object> subschema) {
            definitions.add(subschema);
            return definitions.size() - 1;
        }

        /** Adds the moved subschemas to the root {@code $defs}, so that their local refs still resolve. */
        void addDefinitions(Map<String, Object> root) {
            if (definitions.isEmpty()) {
                return;
            }
            Map<String, Object> defs = new LinkedHashMap<>(root.get("$defs") instanceof Map<?, ?> existing
                    ? asMap(existing) : Map.of());
            int next = 0;
            for (Map<String, Object> definition : definitions) {
                String name;
                do {
                    name = "calm-hub-" + next++;
                } while (defs.containsKey(name));
                defs.put(name, definition);
                definitionNames.add(name);
            }
            root.put("$defs", defs);
        }

        void compile(SchemaRepository repository) {
            for (String name : definitionNames) {
                validators.add(repository.validator(JsonSchema.of(new JsonObject().put("$ref", options.getBaseUri() + "#/$defs/" + name)), options));
            }
        }

        String error(String instanceType, String format, Object instance) {
            if (format == null || !format.startsWith(prefix)) {
                return null;
            }
            return checks.get(Integer.parseInt(format.substring(prefix.length()))).apply(instance);
        }
    }
}
