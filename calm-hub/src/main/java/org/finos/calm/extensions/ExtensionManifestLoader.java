package org.finos.calm.extensions;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.core.json.DecodeException;
import io.vertx.core.json.JsonObject;
import io.vertx.json.schema.Draft;
import io.vertx.json.schema.JsonSchema;
import io.vertx.json.schema.JsonSchemaOptions;
import io.vertx.json.schema.OutputFormat;
import io.vertx.json.schema.OutputUnit;
import io.vertx.json.schema.Validator;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Reads and validates extension manifests (ADR 0012). The JSON Schema checks the shape. This class
 * checks what the schema cannot: route references, the scope rules of ADR 0011, the id against the
 * folder name and the MCP tool name length. Every failure is an {@link IllegalStateException}
 * that names the manifest, so that Hub stops at start up with a clear message.
 */
public class ExtensionManifestLoader {

    public static final String MANIFEST_FILE = "extension.json";
    public static final String BUILTIN_BASE = "META-INF/calm-extensions/builtin/";
    static final String BUILTIN_INDEX = "index.txt";
    static final Set<Integer> SUPPORTED_HUB_API = Set.of(0);
    /** The tool name limit of common MCP clients. The MCP specification allows 128. */
    static final int MAX_TOOL_NAME_LENGTH = 64;
    /** Ids that would clash with the static {@code calm.extensions.*} settings. */
    static final Set<String> RESERVED_IDS = Set.of("dir");

    private static final Logger LOG = LoggerFactory.getLogger(ExtensionManifestLoader.class);
    private static final String SCHEMA_PATH = "META-INF/calm-extensions/schema/%d/extension.schema.json";
    private static final Pattern PATH_PARAM = Pattern.compile("\\{([^}]+)}");
    private static final Set<String> NAMESPACE_SCOPES = Set.of("read", "write", "admin");
    private static final Set<String> DOMAIN_SCOPES = Set.of("domain_read", "domain_write", "domain_admin");
    private static final Pattern GENERIC_SCHEMA_ERROR = Pattern.compile(
            "Property \".*\" does not match schema|A subschema had errors|Items did not match schema"
                    + "|Property name \".*\" does not match schema");
    private static final Pattern ADDITIONAL_PROPERTY = Pattern.compile("Property \".*\" does not match additional properties schema");
    private static final Set<String> GET_ONLY_POINTS = Set.of("screen", "designer-tab", "landing-card", "detail-panel");
    /** The path parameters that the UI can fill for a designer tab (calm-hub-ui contributions.ts). */
    static final List<String> DESIGNER_TAB_PARAMS = List.of("namespace", "resourceType", "resourceId", "version",
            "selectedElement");

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, true);
    private final Map<Integer, Validator> validators = new HashMap<>();

    /** Loads {@code <dir>/<id>/extension.json} for each folder in {@code dir}. Hidden folders and folders without a manifest are skipped. */
    public List<ExtensionManifest> loadDirectory(Path dir) {
        if (!Files.isDirectory(dir)) {
            throw new IllegalStateException("calm.extensions.dir " + dir + " is not a directory");
        }
        List<Path> folders;
        try (Stream<Path> entries = Files.list(dir)) {
            folders = entries.filter(Files::isDirectory)
                    .filter(p -> !p.getFileName().toString().startsWith("."))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot list extensions in " + dir, e);
        }
        List<ExtensionManifest> manifests = new ArrayList<>();
        for (Path folder : folders) {
            Path file = folder.resolve(MANIFEST_FILE);
            if (!Files.isRegularFile(file)) {
                LOG.warn("Skipping extension folder {}: no {}", folder, MANIFEST_FILE);
                continue;
            }
            String json;
            try {
                json = Files.readString(file, StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException("Cannot read extension manifest " + file, e);
            }
            manifests.add(parse(json, folder.getFileName().toString(), file.toString()));
        }
        return manifests;
    }

    /**
     * Loads the built-in manifests listed in {@code <base>index.txt}, one id on each line, from
     * {@code <base><id>/extension.json}. A classpath cannot be listed in a native image, so the
     * index is required. With no index there are no built-in extensions.
     */
    public List<ExtensionManifest> loadClasspath(ClassLoader classLoader, String base) {
        String index = readResource(classLoader, base + BUILTIN_INDEX);
        if (index == null) {
            return List.of();
        }
        List<ExtensionManifest> manifests = new ArrayList<>();
        for (String line : index.lines().map(String::trim).toList()) {
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            String resource = base + line + "/" + MANIFEST_FILE;
            String json = readResource(classLoader, resource);
            if (json == null) {
                throw new IllegalStateException("Built-in extension " + line + " has no classpath resource " + resource);
            }
            manifests.add(parse(json, line, "classpath:" + resource));
        }
        return manifests;
    }

    /**
     * @param expectedId the folder name, which the manifest id must equal
     * @param source     names the manifest in error messages
     */
    public ExtensionManifest parse(String json, String expectedId, String source) {
        JsonObject raw;
        try {
            raw = new JsonObject(json);
        } catch (DecodeException | ClassCastException e) {
            throw invalid(source, List.of("not a JSON object"));
        }
        Object hubApi = raw.getValue("hubApi");
        if (!(hubApi instanceof Integer version) || !SUPPORTED_HUB_API.contains(version)) {
            throw invalid(source, List.of("hubApi must be one of " + SUPPORTED_HUB_API + ", but was " + hubApi));
        }
        List<String> schemaErrors = schemaErrors(validator(version).validate(raw));
        if (!schemaErrors.isEmpty()) {
            throw invalid(source, schemaErrors);
        }
        ExtensionManifest manifest;
        try {
            manifest = mapper.convertValue(raw.getMap(), ExtensionManifest.class);
        } catch (IllegalArgumentException e) {
            // The schema and the records disagree, which is a Hub defect, not an author error.
            throw new IllegalStateException("Cannot read extension manifest " + source, e);
        }
        List<String> problems = check(manifest, expectedId);
        if (!problems.isEmpty()) {
            throw invalid(source, problems);
        }
        warnUnfillableTabs(manifest, source);
        return manifest;
    }

    static List<String> check(ExtensionManifest manifest, String expectedId) {
        List<String> problems = new ArrayList<>();
        String id = manifest.id();
        if (!id.equals(expectedId)) {
            problems.add("id '" + id + "' must equal the folder name '" + expectedId + "'");
        }
        if (RESERVED_IDS.contains(id)) {
            problems.add("id '" + id + "' is reserved for calm.extensions." + id);
        }
        checkRoutes(manifest, problems);
        checkCommands(manifest, problems);
        checkContributions(manifest, problems);
        return problems;
    }

    private static void checkRoutes(ExtensionManifest manifest, List<String> problems) {
        Set<String> ids = new HashSet<>();
        for (ExtensionManifest.Route route : manifest.routes()) {
            String where = "route '" + route.id() + "'";
            if (!ids.add(route.id())) {
                problems.add(where + " is declared more than once");
            }
            for (String segment : route.path().split("/")) {
                if (segment.equals(".") || segment.equals("..")) {
                    problems.add(where + " path must not have a '" + segment + "' segment");
                }
            }
            List<String> params = pathParams(route.path());
            if (new HashSet<>(params).size() != params.size()) {
                problems.add(where + " path has a parameter more than once");
            }
            if (NAMESPACE_SCOPES.contains(route.scope()) && !params.contains("namespace")) {
                problems.add(where + " has scope '" + route.scope() + "', so its path needs a {namespace} parameter");
            }
            if (DOMAIN_SCOPES.contains(route.scope()) && !params.contains("domain")) {
                problems.add(where + " has scope '" + route.scope() + "', so its path needs a {domain} parameter");
            }
        }
        checkAmbiguousRoutes(manifest.routes(), problems);
    }

    /**
     * The matcher takes the route with more literal segments. When two routes can match one path and
     * have the same number, the manifest order would choose the scope, so Hub refuses them.
     */
    private static void checkAmbiguousRoutes(List<ExtensionManifest.Route> routes, List<String> problems) {
        for (int j = 1; j < routes.size(); j++) {
            for (int i = 0; i < j; i++) {
                ExtensionManifest.Route first = routes.get(i);
                ExtensionManifest.Route second = routes.get(j);
                if (!first.method().equals(second.method())) {
                    continue;
                }
                String[] a = first.path().split("/", -1);
                String[] b = second.path().split("/", -1);
                if (a.length != b.length) {
                    continue;
                }
                boolean overlap = true;
                boolean samePlaces = true;
                int literalsA = 0;
                int literalsB = 0;
                for (int k = 0; k < a.length && overlap; k++) {
                    boolean paramA = isParam(a[k]);
                    boolean paramB = isParam(b[k]);
                    literalsA += paramA ? 0 : 1;
                    literalsB += paramB ? 0 : 1;
                    samePlaces &= paramA == paramB;
                    // A parameter does not match an empty segment.
                    overlap = paramA ? !b[k].isEmpty() : paramB ? !a[k].isEmpty() : a[k].equals(b[k]);
                }
                if (!overlap || literalsA != literalsB) {
                    continue;
                }
                // {a} and {b} in the same place match the same requests.
                String where = "route '" + second.id() + "'";
                problems.add(samePlaces
                        ? where + " has the same method and path as another route"
                        : where + " and route '" + first.id() + "' can match the same path with the same number of "
                                + "literal segments, so neither takes priority");
            }
        }
    }

    private static boolean isParam(String segment) {
        return segment.length() > 2 && segment.startsWith("{") && segment.endsWith("}");
    }

    private static void checkCommands(ExtensionManifest manifest, List<String> problems) {
        manifest.commands().forEach((name, command) -> {
            String where = "command '" + name + "'";
            String toolName = toolName(manifest.id(), name);
            if (toolName.length() > MAX_TOOL_NAME_LENGTH) {
                problems.add(where + " gives the MCP tool name '" + toolName + "', which is longer than "
                        + MAX_TOOL_NAME_LENGTH + " characters");
            }
            manifest.route(command.route()).ifPresentOrElse(route -> {
                Object properties = command.input().get("properties");
                Object required = command.input().get("required");
                for (String param : pathParams(route.path())) {
                    boolean declared = properties instanceof Map<?, ?> map && map.containsKey(param);
                    boolean isRequired = required instanceof List<?> list && list.contains(param);
                    if (!declared || !isRequired) {
                        problems.add(where + " input must have a required property '" + param
                                + "' for the path of route '" + route.id() + "'");
                    }
                }
            }, () -> problems.add(where + " names route '" + command.route() + "', which is not declared"));
        });
    }

    private static void checkContributions(ExtensionManifest manifest, List<String> problems) {
        manifest.contributes().byRoutePoint().forEach((point, entries) -> {
            Set<String> ids = new HashSet<>();
            for (ExtensionManifest.RouteContribution entry : entries) {
                String where = point + " '" + entry.id() + "'";
                if (!ids.add(entry.id())) {
                    problems.add(where + " is declared more than once");
                }
                manifest.route(entry.route()).ifPresentOrElse(route -> {
                    if (GET_ONLY_POINTS.contains(point) && !"GET".equals(route.method())) {
                        problems.add(where + " must name a GET route, but route '" + route.id() + "' is " + route.method());
                    }
                }, () -> problems.add(where + " names route '" + entry.route() + "', which is not declared"));
            }
        });
        List<ExtensionManifest.DecoratorView> views = manifest.contributes().decoratorViews();
        if (views != null) {
            Set<String> ids = new HashSet<>();
            for (ExtensionManifest.DecoratorView view : views) {
                if (!ids.add(view.id())) {
                    problems.add("decorator-views '" + view.id() + "' is declared more than once");
                }
            }
        }
    }

    /**
     * The UI fills a designer tab path only from the resource it shows, so it hides a tab whose path needs
     * another parameter. Hub still loads the manifest, because the route can serve other contributions.
     */
    private static void warnUnfillableTabs(ExtensionManifest manifest, String source) {
        for (ExtensionManifest.RouteContribution tab : manifest.contributes().byRoutePoint().getOrDefault("designer-tab", List.of())) {
            manifest.route(tab.route()).ifPresent(route -> pathParams(route.path()).stream()
                    .filter(param -> !DESIGNER_TAB_PARAMS.contains(param))
                    .forEach(param -> LOG.warn("Extension manifest {}: the UI hides designer-tab '{}', because it cannot fill "
                            + "{{}} in the path of route '{}'. It fills only {}", source, tab.id(), param, route.id(),
                            DESIGNER_TAB_PARAMS)));
        }
    }

    public static String toolName(String extensionId, String commandName) {
        return "ext_" + extensionId + "_" + commandName;
    }

    static List<String> pathParams(String path) {
        List<String> params = new ArrayList<>();
        Matcher matcher = PATH_PARAM.matcher(path);
        while (matcher.find()) {
            params.add(matcher.group(1));
        }
        return params;
    }

    private Validator validator(int hubApi) {
        return validators.computeIfAbsent(hubApi, version -> {
            String schema = readResource(ExtensionManifestLoader.class.getClassLoader(), SCHEMA_PATH.formatted(version));
            if (schema == null) {
                throw new IllegalStateException("No extension manifest schema for hubApi " + version);
            }
            JsonObject json = new JsonObject(schema);
            return Validator.create(JsonSchema.of(json), new JsonSchemaOptions()
                    .setDraft(Draft.DRAFT202012)
                    .setBaseUri(json.getString("$id"))
                    .setOutputFormat(OutputFormat.Basic));
        });
    }

    /**
     * vertx-json-schema also reports each failure at every level above it, with generic messages. Drop
     * those, so that an author sees "/routes/0/readonly: ..." and not "/routes: Property "routes" does
     * not match schema".
     */
    static List<String> schemaErrors(OutputUnit result) {
        if (Boolean.TRUE.equals(result.getValid())) {
            return List.of();
        }
        List<OutputUnit> units = result.getErrors() == null || result.getErrors().isEmpty() ? List.of(result) : result.getErrors();
        List<String[]> errors = units.stream()
                .map(unit -> new String[]{location(unit), unit.getError()})
                .filter(error -> !GENERIC_SCHEMA_ERROR.matcher(String.valueOf(error[1])).matches())
                .toList();
        Set<String> kept = new LinkedHashSet<>();
        for (String[] error : errors) {
            // A property that fails its own schema, or holds a failure, is also reported as an additional property.
            boolean spurious = ADDITIONAL_PROPERTY.matcher(String.valueOf(error[1])).matches()
                    && errors.stream().anyMatch(other -> isBelow(other[0], error[0])
                    || (other[0].equals(error[0]) && !ADDITIONAL_PROPERTY.matcher(String.valueOf(other[1])).matches()));
            if (!spurious) {
                kept.add(error[0] + ": " + error[1]);
            }
        }
        return kept.isEmpty() ? List.of("/: does not match the manifest schema") : List.copyOf(kept);
    }

    private static String location(OutputUnit unit) {
        String location = unit.getInstanceLocation() == null ? "" : unit.getInstanceLocation();
        location = location.startsWith("#") ? location.substring(1) : location;
        return location.isEmpty() ? "/" : location;
    }

    private static boolean isBelow(String location, String parent) {
        return parent.equals("/") ? !location.equals("/") : location.startsWith(parent + "/");
    }

    private static String readResource(ClassLoader classLoader, String name) {
        try (InputStream in = classLoader.getResourceAsStream(name)) {
            return in == null ? null : new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read classpath resource " + name, e);
        }
    }

    private static IllegalStateException invalid(String source, List<String> problems) {
        return new IllegalStateException("Invalid extension manifest " + source + ": " + String.join("; ", problems));
    }
}
