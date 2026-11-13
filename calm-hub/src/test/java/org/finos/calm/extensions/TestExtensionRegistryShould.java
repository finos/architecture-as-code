package org.finos.calm.extensions;

import io.smallrye.config.EnvConfigSource;
import io.smallrye.config.PropertiesConfigSource;
import io.smallrye.config.SmallRyeConfig;
import io.smallrye.config.SmallRyeConfigBuilder;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.finos.calm.config.ExtensionsConfig;
import org.finos.calm.domain.extensions.ExtensionManifest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.finos.calm.extensions.TestExtensionManifestLoaderShould.captureWarnings;
import static org.finos.calm.extensions.TestExtensionManifestLoaderShould.route;
import static org.finos.calm.extensions.TestExtensionManifestLoaderShould.valid;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TestExtensionRegistryShould {

    private static final String BUILTIN_BASE = "extensions-test/builtin/";
    private static final String NO_BUILTINS = "extensions-test/none/";

    @TempDir
    Path tempDir;

    private final Map<String, String> properties = new HashMap<>();
    private final Map<String, String> environment = new HashMap<>();

    @Test
    void warn_about_settings_for_unknown_extensions() {
        properties.put("calm.extensions.\"missing\".enabled", "false");
        properties.put("calm.extensions.other.order", "2");

        List<String> warnings = captureWarnings(ExtensionRegistry.class, () -> registry(Optional.empty(), NO_BUILTINS));

        assertThat(warnings, hasItem(containsString("unknown extension id 'missing'")));
        assertThat(warnings, hasItem(containsString("unknown extension id 'other'")));
    }

    @Test
    void warn_about_an_environment_variable_for_an_unknown_extension() {
        environment.put("CALM_EXTENSIONS__TEAM_SERVCES__BACKEND_URL", "https://services.internal");
        environment.put("CALM_EXTENSIONS_OTHER_ORDER", "10");

        List<String> warnings = captureWarnings(ExtensionRegistry.class, () -> registry(Optional.empty(), NO_BUILTINS));

        assertThat(warnings, hasItem(containsString("unknown extension id 'team-servces'")));
        assertThat(warnings, hasItem(containsString("unknown extension id 'other'")));
    }

    @Test
    void find_the_id_in_each_form_of_a_per_id_setting() {
        assertThat(ExtensionRegistry.settingId("calm.extensions.\"team-services\".backend-url"),
                equalTo(Optional.of("team-services")));
        assertThat(ExtensionRegistry.settingId("calm.extensions.team-services.enabled"), equalTo(Optional.of("team-services")));
        assertThat(ExtensionRegistry.settingId("CALM_EXTENSIONS__TEAM_SERVICES__BACKEND_URL"),
                equalTo(Optional.of("team-services")));
        assertThat(ExtensionRegistry.settingId("CALM_EXTENSIONS_TEAM_SERVICES_ORDER"), equalTo(Optional.of("team-services")));
        assertThat(ExtensionRegistry.settingId("calm.extensions.dir"), equalTo(Optional.empty()));
        assertThat(ExtensionRegistry.settingId("CALM_EXTENSIONS_DIR"), equalTo(Optional.empty()));
        assertThat(ExtensionRegistry.settingId("calm.extensions.\"team-services\".colour"), equalTo(Optional.empty()));
    }

    @Test
    void not_warn_about_known_extensions_or_shared_settings() {
        properties.put("calm.extensions.\"builtin-views\".enabled", "false");
        environment.put("CALM_EXTENSIONS__BUILTIN_VIEWS__ORDER", "10");

        List<String> warnings = captureWarnings(ExtensionRegistry.class, () -> registry(Optional.empty(), BUILTIN_BASE));

        assertThat(warnings, empty());
    }

    @Test
    void have_no_extensions_with_no_dir_and_no_built_ins() {
        ExtensionRegistry registry = registry(Optional.empty(), NO_BUILTINS);

        assertThat(registry.enabled(), empty());
        assertThat(registry.available(), empty());
    }

    @Test
    void ignore_a_blank_dir() {
        ExtensionRegistry registry = registry(Optional.of(" "), NO_BUILTINS);

        assertThat(registry.enabled(), empty());
    }

    @Test
    void enable_a_manifest_by_default_and_keep_its_backend_url() throws IOException {
        write("team-services", valid());
        properties.put("calm.extensions.\"team-services\".backend-url", "https://services.internal:8443/api");

        ExtensionRegistry registry = registry(dir(), NO_BUILTINS);

        RegisteredExtension extension = registry.find("team-services").orElseThrow();
        assertThat(extension.backendUrl(), equalTo(Optional.of(URI.create("https://services.internal:8443/api"))));
        assertThat(extension.order(), equalTo(0));
        assertThat(registry.find("missing"), equalTo(Optional.empty()));
    }

    @Test
    void load_built_in_and_directory_manifests_together() throws IOException {
        write("team-services", valid());
        properties.put("calm.extensions.\"team-services\".backend-url", "http://localhost:8091");

        ExtensionRegistry registry = registry(dir(), BUILTIN_BASE);

        assertThat(ids(registry), contains("builtin-views", "team-services"));
    }

    @Test
    void sort_by_order_and_then_by_id() throws IOException {
        write("alpha", decoratorViewsOnly("alpha"));
        write("beta", decoratorViewsOnly("beta"));
        write("gamma", decoratorViewsOnly("gamma"));
        properties.put("calm.extensions.\"gamma\".order", "-1");
        properties.put("calm.extensions.\"alpha\".order", "5");

        ExtensionRegistry registry = registry(dir(), NO_BUILTINS);

        assertThat(ids(registry), contains("gamma", "beta", "alpha"));
    }

    @Test
    void leave_out_a_disabled_extension_and_not_need_its_backend_url() throws IOException {
        write("team-services", valid());
        write("alpha", decoratorViewsOnly("alpha"));
        properties.put("calm.extensions.\"team-services\".enabled", "false");

        ExtensionRegistry registry = registry(dir(), NO_BUILTINS);

        assertThat(ids(registry), contains("alpha"));
    }

    @Test
    void read_a_setting_without_quotes() throws IOException {
        write("alpha", decoratorViewsOnly("alpha"));
        properties.put("calm.extensions.alpha.enabled", "FALSE");

        assertThat(registry(dir(), NO_BUILTINS).enabled(), empty());
    }

    @Test
    void read_settings_from_environment_variables_for_an_id_with_a_dash() throws IOException {
        write("team-services", valid());
        write("alpha", decoratorViewsOnly("alpha"));
        environment.put("CALM_EXTENSIONS__TEAM_SERVICES__BACKEND_URL", "https://services.internal");
        environment.put("CALM_EXTENSIONS__TEAM_SERVICES__ORDER", "-5");
        environment.put("CALM_EXTENSIONS_ALPHA_ENABLED", "false");
        environment.put("CALM_EXTENSIONS_DIR", tempDir.toString());

        ExtensionRegistry registry = registry(Optional.empty(), NO_BUILTINS);

        assertThat(ids(registry), contains("team-services"));
        assertThat(registry.find("team-services").orElseThrow().order(), equalTo(-5));
        assertThat(registry.find("team-services").orElseThrow().backendUrl(),
                equalTo(Optional.of(URI.create("https://services.internal"))));
    }

    @Test
    void need_a_backend_url_for_an_enabled_extension_with_routes() throws IOException {
        write("team-services", valid());

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> registry(dir(), NO_BUILTINS));

        assertThat(e.getMessage(), equalTo("Invalid calm.extensions configuration: calm.extensions.\"team-services\".backend-url "
                + "must be set, because extension 'team-services' is enabled and has routes"));
    }

    @Test
    void report_every_bad_setting() throws IOException {
        write("alpha", decoratorViewsOnly("alpha"));
        properties.put("calm.extensions.\"alpha\".enabled", "yes");
        properties.put("calm.extensions.\"alpha\".order", "first");
        properties.put("calm.extensions.\"alpha\".backend-url", "https://user:secret@example.com");

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> registry(dir(), NO_BUILTINS));

        assertThat(e.getMessage(), containsString("calm.extensions.\"alpha\".enabled must be true or false, but was 'yes'"));
        assertThat(e.getMessage(), containsString("calm.extensions.\"alpha\".order must be an integer, but was 'first'"));
        assertThat(e.getMessage(), containsString("calm.extensions.\"alpha\".backend-url must be an absolute http or https URL"));
        assertThat(e.getMessage(), not(containsString("secret")));
    }

    @Test
    void reject_a_backend_url_that_is_not_http() throws IOException {
        for (String url : List.of("file:///etc/passwd", "localhost:8091", "https://example.com/?q=1", "https://example.com/#x", "http://[bad")) {
            write("alpha", decoratorViewsOnly("alpha"));
            properties.put("calm.extensions.\"alpha\".backend-url", url);

            IllegalStateException e = assertThrows(IllegalStateException.class, () -> registry(dir(), NO_BUILTINS), url);

            assertThat(url, e.getMessage(), containsString("backend-url must be an absolute http or https URL"));
        }
    }

    @Test
    void reject_an_id_in_the_directory_and_the_built_ins() throws IOException {
        write("builtin-views", decoratorViewsOnly("builtin-views"));

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> registry(dir(), BUILTIN_BASE));

        assertThat(e.getMessage(), containsString("extension id 'builtin-views' is declared by more than one manifest"));
    }

    @Test
    void reject_a_decorator_view_id_that_two_enabled_extensions_declare() throws IOException {
        write("scanner", decoratorViewsOnly("scanner", "deployment"));

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> registry(dir(), BUILTIN_BASE));

        assertThat(e.getMessage(), containsString(
                "decorator view id 'deployment' is declared by extensions 'builtin-views' and 'scanner'"));
    }

    @Test
    void allow_a_decorator_view_id_of_a_disabled_extension() throws IOException {
        write("scanner", decoratorViewsOnly("scanner", "deployment"));
        properties.put("calm.extensions.\"builtin-views\".enabled", "false");

        assertThat(ids(registry(dir(), BUILTIN_BASE)), contains("scanner"));
    }

    @Test
    void stop_on_an_invalid_manifest() throws IOException {
        write("team-services", valid().put("hubApi", 2));

        IllegalStateException e = assertThrows(IllegalStateException.class, () -> registry(dir(), NO_BUILTINS));

        assertThat(e.getMessage(), containsString("hubApi must be one of [0], but was 2"));
    }

    @Test
    void list_every_route_on_a_hub_that_can_write() throws IOException {
        write("team-services", withReadOnlySearch());
        properties.put("calm.extensions.\"team-services\".backend-url", "http://localhost:8091");

        ExtensionManifest manifest = registry(dir(), NO_BUILTINS).available().getFirst();

        assertThat(manifest.routes().stream().map(ExtensionManifest.Route::id).toList(),
                contains("screen", "services", "domain-services", "add-service", "search", "replace"));
        assertThat(manifest.commands().keySet(), contains("add", "list-services"));
    }

    @Test
    void leave_out_write_routes_and_their_commands_and_contributions_on_a_read_only_hub() throws IOException {
        write("team-services", withReadOnlySearch());
        properties.put("calm.extensions.\"team-services\".backend-url", "http://localhost:8091");
        properties.put("calm.readonly", "true");

        ExtensionRegistry registry = registry(dir(), NO_BUILTINS);
        ExtensionManifest manifest = registry.available().getFirst();

        assertThat(manifest.routes().stream().map(ExtensionManifest.Route::id).toList(),
                contains("screen", "services", "domain-services", "search"));
        assertThat(manifest.commands().keySet(), contains("list-services"));
        assertThat(manifest.contributes().action(), empty());
        assertThat(manifest.contributes().screen().getFirst().id(), equalTo("services"));
        assertThat(manifest.contributes().searchProvider().getFirst().route(), equalTo("search"));
        assertThat(manifest.contributes().decoratorViews().getFirst().id(), equalTo("control-evaluation"));
        assertThat(manifest.contributes().chat(), equalTo(null));
        // The proxy (ADR 0011) still sees every route, and refuses the write routes itself.
        assertThat(registry.enabled().getFirst().manifest().routes().size(), equalTo(6));
    }

    private static JsonObject withReadOnlySearch() {
        JsonObject manifest = valid();
        manifest.getJsonArray("routes")
                .add(route("search", "POST", "/search", "authenticated").put("readOnly", true))
                .add(route("replace", "PUT", "/namespaces/{namespace}/services", "write"));
        manifest.getJsonObject("commands").put("add", new JsonObject()
                .put("route", "add-service")
                .put("description", "Add a service")
                .put("input", new JsonObject()
                        .put("type", "object")
                        .put("properties", new JsonObject().put("namespace", new JsonObject().put("type", "string")))
                        .put("required", new JsonArray().add("namespace"))));
        manifest.getJsonObject("contributes").put("search-provider", new JsonArray()
                .add(TestExtensionManifestLoaderShould.contribution("services", "search")));
        return manifest;
    }

    private static JsonObject decoratorViewsOnly(String id) {
        return decoratorViewsOnly(id, id + "-view");
    }

    private static JsonObject decoratorViewsOnly(String id, String viewId) {
        JsonObject manifest = valid().put("id", id);
        manifest.remove("routes");
        manifest.remove("commands");
        manifest.put("contributes", new JsonObject().put("decorator-views",
                new JsonArray().add(TestExtensionManifestLoaderShould.decoratorView(viewId))));
        return manifest;
    }

    private static List<String> ids(ExtensionRegistry registry) {
        return registry.enabled().stream().map(RegisteredExtension::id).toList();
    }

    private Optional<String> dir() {
        return Optional.of(tempDir.toString());
    }

    private void write(String folder, JsonObject manifest) throws IOException {
        Path dir = Files.createDirectories(tempDir.resolve(folder));
        Files.writeString(dir.resolve("extension.json"), manifest.encodePrettily());
    }

    private ExtensionRegistry registry(Optional<String> dir, String builtinBase) {
        dir.ifPresent(d -> properties.put("calm.extensions.dir", d));
        SmallRyeConfig source = new SmallRyeConfigBuilder()
                .withMapping(ExtensionsConfig.class)
                .withSources(new PropertiesConfigSource(Map.copyOf(properties), "test", 100))
                .withSources(new EnvConfigSource(Map.copyOf(environment), 300))
                .build();
        ExtensionRegistry registry = new ExtensionRegistry(source.getConfigMapping(ExtensionsConfig.class), source,
                getClass().getClassLoader(), builtinBase);
        registry.load();
        return registry;
    }
}
