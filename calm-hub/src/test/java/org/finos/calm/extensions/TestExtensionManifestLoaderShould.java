package org.finos.calm.extensions;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.logging.Handler;
import java.util.logging.Level;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import java.util.stream.Stream;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestExtensionManifestLoaderShould {

    private static final String ID = "team-services";
    private static final String BUILTIN_BASE = "extensions-test/builtin/";

    private final ExtensionManifestLoader loader = new ExtensionManifestLoader();

    @TempDir
    Path tempDir;

    static JsonObject valid() {
        return new JsonObject()
                .put("id", ID)
                .put("version", "1.2.0")
                .put("hubApi", 0)
                .put("name", "Team services")
                .put("description", "The services that a team owns")
                .put("provider", "Platform Engineering")
                .put("routes", new JsonArray()
                        .add(route("screen", "GET", "/screen", "authenticated"))
                        .add(route("services", "GET", "/namespaces/{namespace}/services", "read"))
                        .add(route("domain-services", "GET", "/domains/{domain}/services", "domain_read"))
                        .add(route("add-service", "POST", "/namespaces/{namespace}/services", "write")))
                .put("commands", new JsonObject()
                        .put("list-services", new JsonObject()
                                .put("route", "services")
                                .put("description", "List services")
                                .put("input", new JsonObject()
                                        .put("type", "object")
                                        .put("properties", new JsonObject().put("namespace", new JsonObject().put("type", "string")))
                                        .put("required", new JsonArray().add("namespace")))
                                .put("idempotent", true)))
                .put("contributes", new JsonObject()
                        .put("screen", new JsonArray().add(contribution("services", "screen")))
                        .put("action", new JsonArray().add(contribution("add", "add-service")))
                        .put("decorator-views", new JsonArray().add(decoratorView("control-evaluation"))));
    }

    static JsonObject route(String id, String method, String path, String scope) {
        return new JsonObject().put("id", id).put("method", method).put("path", path).put("scope", scope);
    }

    static JsonObject contribution(String id, String route) {
        return new JsonObject().put("id", id).put("title", "Title").put("route", route);
    }

    static JsonObject decoratorView(String id) {
        return new JsonObject()
                .put("id", id)
                .put("match", new JsonObject().put("type", "control-evaluation"))
                .put("label", "Control evaluations")
                .put("overlay", new JsonObject()
                        .put("status", "/status")
                        .put("map", new JsonObject().put("met", "ok").put("not-met", "error"))
                        .put("default", "info")
                        .put("label", "/control/unique-id"));
    }

    private static JsonObject routes(JsonObject m) {
        return m.getJsonArray("routes").getJsonObject(0);
    }

    private static JsonObject command(JsonObject m) {
        return m.getJsonObject("commands").getJsonObject("list-services");
    }

    private static JsonObject view(JsonObject m) {
        return m.getJsonObject("contributes").getJsonArray("decorator-views").getJsonObject(0);
    }

    @Test
    void read_a_valid_manifest_into_records() {
        ExtensionManifest manifest = loader.parse(valid().encode(), ID, "test");

        assertThat(manifest.id(), equalTo(ID));
        assertThat(manifest.hubApi(), equalTo(0));
        assertThat(manifest.routes(), hasSize(4));
        assertThat(manifest.routes().getFirst().readOnly(), equalTo(false));
        ExtensionManifest.Command command = manifest.commands().get("list-services");
        assertThat(command.route(), equalTo("services"));
        assertThat(command.idempotent(), equalTo(true));
        assertThat(command.destructive(), nullValue());
        assertThat(manifest.contributes().screen().getFirst().route(), equalTo("screen"));
        ExtensionManifest.DecoratorView view = manifest.contributes().decoratorViews().getFirst();
        assertThat(view.match().type(), equalTo("control-evaluation"));
        assertThat(view.overlay().defaultLevel(), equalTo("info"));
        assertThat(view.overlay().map(), equalTo(Map.of("met", "ok", "not-met", "error")));
    }

    @Test
    void accept_a_manifest_with_only_decorator_views() {
        JsonObject m = valid();
        m.remove("routes");
        m.remove("commands");
        m.put("contributes", new JsonObject().put("decorator-views", new JsonArray().add(new JsonObject()
                .put("id", "deployments")
                .put("match", new JsonObject().put("schema", "https://calm.finos.org/standards/deployment.json"))
                .put("label", "Deployments"))));

        ExtensionManifest manifest = loader.parse(m.encode(), ID, "test");

        assertThat(manifest.routes(), empty());
        assertThat(manifest.commands().isEmpty(), equalTo(true));
        assertThat(manifest.contributes().decoratorViews().getFirst().overlay(), nullValue());
    }

    @Test
    void accept_routes_that_one_path_cannot_match_twice_or_where_one_has_more_literals() {
        JsonObject m = valid();
        m.getJsonArray("routes")
                .add(route("service", "GET", "/services/{service}", "authenticated"))
                .add(route("service-admin", "GET", "/services/admin", "global_admin"))
                .add(route("delete-service", "DELETE", "/services/{service}", "authenticated"))
                .add(route("root", "GET", "/", "authenticated"))
                .add(route("item", "GET", "/{item}", "authenticated"))
                .add(route("report", "GET", "/{namespace}/report/full", "read"))
                .add(route("public", "GET", "/public/{id}/all", "authenticated"));

        assertThat(loader.parse(m.encode(), ID, "test").routes(), hasSize(11));
    }

    static Stream<Arguments> invalidManifests() {
        return Stream.<Arguments>of(
                // Schema
                invalid("an unknown top-level field", m -> m.put("backend", new JsonObject()), "/backend: "),
                invalid("a missing name", m -> m.remove("name"), "name"),
                invalid("a misspelt readOnly", m -> routes(m).put("readonly", true), "/routes/0/readonly: "),
                invalid("an unknown scope", m -> routes(m).put("scope", "everyone"), "/routes/0/scope"),
                invalid("a missing scope", m -> routes(m).remove("scope"), "scope"),
                invalid("an unknown method", m -> routes(m).put("method", "HEAD"), "/routes/0/method"),
                invalid("a path with a query", m -> routes(m).put("path", "/screen?x=1"), "/routes/0/path"),
                invalid("a path with an @", m -> routes(m).put("path", "/@evil/x"), "/routes/0/path"),
                invalid("a path with a double slash", m -> routes(m).put("path", "//screen"), "/routes/0/path"),
                invalid("a path with an encoded character", m -> routes(m).put("path", "/a%2fb"), "/routes/0/path"),
                invalid("an upper-case id", m -> m.put("id", "Team"), "/id"),
                invalid("a version that is not semantic", m -> m.put("version", "1.0"), "/version"),
                invalid("an unknown extension point", m -> m.getJsonObject("contributes").put("toolbar", new JsonArray()), "/contributes/toolbar: "),
                invalid("a decorator view with a route", m -> view(m).put("route", "screen"), "/contributes/decorator-views/0/route: "),
                invalid("a match with type and schema", m -> view(m).getJsonObject("match").put("schema", "https://x.org/s.json"), "/contributes/decorator-views/0/match"),
                invalid("an empty match", m -> view(m).put("match", new JsonObject()), "/contributes/decorator-views/0/match"),
                invalid("an overlay level off the scale", m -> view(m).getJsonObject("overlay").getJsonObject("map").put("met", "green"), "/contributes/decorator-views/0/overlay/map/met"),
                invalid("an overlay status that is not a JSON Pointer", m -> view(m).getJsonObject("overlay").put("status", "status"), "/contributes/decorator-views/0/overlay/status"),
                invalid("a command input that is not an object schema", m -> command(m).getJsonObject("input").put("type", "string"), "/commands/list-services/input/type"),
                invalid("a command name with an underscore", m -> m.getJsonObject("commands").put("list_all", command(m).copy()), "/commands/list_all: "),
                // Java checks
                invalid("an id that is not the folder name", m -> m.put("id", "other"), "id 'other' must equal the folder name 'team-services'"),
                invalid("a duplicate route id", m -> m.getJsonArray("routes").add(route("screen", "GET", "/other", "authenticated")), "route 'screen' is declared more than once"),
                invalid("a duplicate method and path", m -> m.getJsonArray("routes").add(route("other", "GET", "/namespaces/{ns}/services", "authenticated")), "route 'other' has the same method and path"),
                invalid("two routes that can match one path", m -> m.getJsonArray("routes")
                        .add(route("report", "GET", "/{namespace}/report", "read"))
                        .add(route("public", "GET", "/public/{id}", "authenticated")),
                        "route 'public' and route 'report' can match the same path with the same number of literal segments"),
                invalid("a parameter route that shadows a write route", m -> m.getJsonArray("routes")
                        .add(route("bulk", "POST", "/namespaces/bulk/{id}", "authenticated")),
                        "route 'bulk' and route 'add-service' can match the same path"),
                invalid("a dot-dot segment", m -> routes(m).put("path", "/a/../b"), "route 'screen' path must not have a '..' segment"),
                invalid("a repeated parameter", m -> routes(m).put("path", "/{a}/{a}"), "route 'screen' path has a parameter more than once"),
                invalid("a namespace scope with no {namespace}", m -> routes(m).put("scope", "admin"), "route 'screen' has scope 'admin', so its path needs a {namespace} parameter"),
                invalid("a domain scope with no {domain}", m -> routes(m).put("scope", "domain_write"), "route 'screen' has scope 'domain_write', so its path needs a {domain} parameter"),
                invalid("a command with an unknown route", m -> command(m).put("route", "missing"), "command 'list-services' names route 'missing', which is not declared"),
                invalid("a command input with no path parameter", m -> command(m).getJsonObject("input").put("required", new JsonArray()), "command 'list-services' input must have a required property 'namespace'"),
                invalid("a tool name that is too long", m -> m.getJsonObject("commands").put("c".repeat(50), command(m).copy()), "longer than 64 characters"),
                invalid("a contribution with an unknown route", m -> m.getJsonObject("contributes").getJsonArray("screen").add(contribution("x", "missing")), "screen 'x' names route 'missing', which is not declared"),
                invalid("a screen on a POST route", m -> m.getJsonObject("contributes").getJsonArray("screen").add(contribution("x", "add-service")), "screen 'x' must name a GET route"),
                invalid("a duplicate contribution id", m -> m.getJsonObject("contributes").getJsonArray("screen").add(contribution("services", "screen")), "screen 'services' is declared more than once"),
                invalid("a duplicate decorator view id", m -> m.getJsonObject("contributes").getJsonArray("decorator-views").add(decoratorView("control-evaluation")), "decorator-views 'control-evaluation' is declared more than once")
        );
    }

    private static Arguments invalid(String name, Consumer<JsonObject> change, String expected) {
        return Arguments.of(name, change, expected);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidManifests")
    void reject_a_manifest_with(String name, Consumer<JsonObject> change, String expected) {
        JsonObject manifest = valid();
        change.accept(manifest);

        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> loader.parse(manifest.encode(), ID, "team-services/extension.json"));

        assertThat(e.getMessage(), containsString("Invalid extension manifest team-services/extension.json: "));
        assertThat(e.getMessage(), containsString(expected));
    }

    @Test
    void report_only_the_field_that_fails_and_not_its_parents() {
        JsonObject manifest = valid();
        routes(manifest).put("readonly", true);
        manifest.remove("version");

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> loader.parse(manifest.encode(), ID, "test"));

        assertThat(e.getMessage(), equalTo("Invalid extension manifest test: "
                + "/: Instance does not have required property \"version\"; "
                + "/routes/0/readonly: Property \"readonly\" does not match additional properties schema"));
    }

    @Test
    void reject_a_reserved_id() {
        JsonObject manifest = valid().put("id", "dir");

        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> loader.parse(manifest.encode(), "dir", "test"));

        assertThat(e.getMessage(), containsString("id 'dir' is reserved for calm.extensions.dir"));
    }

    @Test
    void reject_text_that_is_not_a_json_object() {
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> loader.parse("[1]", ID, "test"));

        assertThat(e.getMessage(), containsString("not a JSON object"));
    }

    @Test
    void reject_text_that_is_not_json() {
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> loader.parse("{", ID, "test"));

        assertThat(e.getMessage(), containsString("not a JSON object"));
    }

    @Test
    void reject_an_unsupported_hub_api_before_the_schema_check() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> loader.parse(valid().put("hubApi", 1).put("unknown", true).encode(), ID, "test"));

        assertThat(e.getMessage(), containsString("hubApi must be one of [0], but was 1"));
    }

    @Test
    void reject_a_hub_api_that_is_not_an_integer() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> loader.parse(valid().put("hubApi", "0").encode(), ID, "test"));

        assertThat(e.getMessage(), containsString("hubApi must be one of [0], but was 0"));
    }

    @Test
    void load_each_folder_of_a_directory_in_name_order() throws IOException {
        write("zeta", valid().put("id", "zeta"));
        write("alpha", valid().put("id", "alpha"));
        Files.createDirectories(tempDir.resolve(".git"));
        Files.writeString(tempDir.resolve("README.md"), "Not a manifest");

        List<ExtensionManifest> manifests = loader.loadDirectory(tempDir);

        assertThat(manifests.stream().map(ExtensionManifest::id).toList(), contains("alpha", "zeta"));
    }

    @Test
    void skip_a_folder_with_no_manifest() throws IOException {
        Files.createDirectories(tempDir.resolve("lost+found"));
        write(ID, valid());

        List<String> warnings = captureWarnings(ExtensionManifestLoader.class, () ->
                assertThat(loader.loadDirectory(tempDir).stream().map(ExtensionManifest::id).toList(), contains(ID)));

        assertThat(warnings, hasItem(containsString(tempDir.resolve("lost+found").toString())));
    }

    @ParameterizedTest
    @ValueSource(strings = {"authenticated", "read", "write", "admin", "domain_read", "domain_write", "domain_admin", "global_admin"})
    void accept_each_allowed_scope(String scope) {
        JsonObject manifest = valid();
        routes(manifest).put("scope", scope).put("path", "/namespaces/{namespace}/domains/{domain}/screen");

        assertThat(loader.parse(manifest.encode(), ID, "test").routes().getFirst().scope(), equalTo(scope));
    }

    @Test
    void reject_a_directory_that_does_not_exist() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> loader.loadDirectory(tempDir.resolve("missing")));

        assertThat(e.getMessage(), containsString("is not a directory"));
    }

    @Test
    void name_the_file_of_an_invalid_manifest() throws IOException {
        write(ID, valid().put("name", ""));

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> loader.loadDirectory(tempDir));

        assertThat(e.getMessage(), containsString(tempDir.resolve(ID).resolve("extension.json").toString()));
        assertThat(e.getMessage(), containsString("/name"));
    }

    @Test
    void load_the_example_manifest_for_local_development() {
        List<ExtensionManifest> manifests = loader.loadDirectory(Path.of("local-dev/extensions"));

        assertThat(manifests.stream().map(ExtensionManifest::id).toList(), contains("example-services"));
    }

    @Test
    void load_the_built_in_manifests_in_the_index() {
        List<ExtensionManifest> manifests = loader.loadClasspath(getClass().getClassLoader(), BUILTIN_BASE);

        assertThat(manifests.stream().map(ExtensionManifest::id).toList(), contains("builtin-views"));
    }

    @Test
    void load_no_built_in_manifests_when_there_is_no_index() {
        assertThat(loader.loadClasspath(getClass().getClassLoader(), "extensions-test/none/"), empty());
    }

    @Test
    void reject_an_index_entry_with_no_manifest() {
        IllegalStateException e = assertThrows(IllegalStateException.class,
                () -> loader.loadClasspath(getClass().getClassLoader(), "extensions-test/broken/"));

        assertThat(e.getMessage(), containsString("Built-in extension missing has no classpath resource"));
    }

    @Test
    void ship_no_built_in_manifests_yet() {
        assertThat(loader.loadClasspath(getClass().getClassLoader(), ExtensionManifestLoader.BUILTIN_BASE), empty());
    }

    @Test
    void warn_about_a_designer_tab_whose_path_the_ui_cannot_fill_and_still_load_it() {
        JsonObject manifest = valid();
        manifest.getJsonArray("routes")
                .add(route("tab", "GET", "/namespaces/{namespace}/{resourceType}/{resourceId}/versions/{version}/{selectedElement}", "read"))
                .add(route("by-resource", "GET", "/namespaces/{namespace}/resources/{resource}", "read"));
        manifest.getJsonObject("contributes").put("designer-tab", new JsonArray()
                .add(contribution("fillable", "tab"))
                .add(contribution("unfillable", "by-resource")));

        List<String> warnings = captureWarnings(ExtensionManifestLoader.class, () ->
                assertThat(loader.parse(manifest.encode(), ID, "test").contributes().designerTab(), hasSize(2)));

        assertThat(warnings, hasSize(1));
        assertThat(warnings, hasItem("Extension manifest test: the UI hides designer-tab 'unfillable', because it cannot "
                + "fill {resource} in the path of route 'by-resource'. It fills only [namespace, resourceType, resourceId, "
                + "version, selectedElement]"));
    }

    static List<String> captureWarnings(Class<?> source, Runnable action) {
        Logger logger = Logger.getLogger(source.getName());
        List<String> warnings = new ArrayList<>();
        Handler handler = new Handler() {
            @Override
            public void publish(LogRecord record) {
                if (record.getLevel().intValue() >= Level.WARNING.intValue()) {
                    warnings.add(record.getMessage());
                }
            }

            @Override
            public void flush() {
            }

            @Override
            public void close() {
            }
        };
        logger.addHandler(handler);
        try {
            action.run();
        } finally {
            logger.removeHandler(handler);
        }
        return warnings;
    }

    private void write(String folder, JsonObject manifest) throws IOException {
        Path dir = Files.createDirectories(tempDir.resolve(folder));
        Files.writeString(dir.resolve("extension.json"), manifest.encodePrettily());
    }
}
