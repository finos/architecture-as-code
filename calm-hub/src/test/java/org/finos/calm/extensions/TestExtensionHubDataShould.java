package org.finos.calm.extensions;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.json.JsonObject;
import jakarta.json.Json;
import org.eclipse.microprofile.config.Config;
import org.finos.calm.domain.NumericResourceId;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.extensions.ExtensionManifest.Route;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.services.ConventionService;
import org.finos.calm.services.ResourceIdResolver;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PatternStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestExtensionHubDataShould {

    private static final Map<String, String> PATH = Map.of("namespace", "finos", "resourceType", "architectures", "resourceId", "7");
    private static final Route ALL = new Route("lens", "POST", "/lens/{namespace}/{resourceType}/{resourceId}", "read", true,
            List.of("document", "detailed-architectures", "c4-mapping"));
    private static final Route DOCUMENT = new Route("lens", "POST", "/lens/{namespace}/{resourceType}/{resourceId}", "read", true,
            List.of("document"));

    private final ArchitectureStore architectures = mock(ArchitectureStore.class);
    private final PatternStore patterns = mock(PatternStore.class);
    private final ConventionService conventions = mock(ConventionService.class);
    private final CalmHubPermissionChecker permissions = mock(CalmHubPermissionChecker.class);
    private final ResourceIdResolver resourceIdResolver = mock(ResourceIdResolver.class);
    private final SecurityIdentity alice = mock(SecurityIdentity.class);
    private ExtensionHubData hubData;

    @BeforeEach
    void setup() throws Exception {
        hubData = new ExtensionHubData(architectures, patterns, conventions, permissions, resourceIdResolver,
                "https://hub.example.com");
        when(resourceIdResolver.forStorage(anyString(), any(), any()))
                .thenAnswer(call -> new NumericResourceId(Integer.parseInt(call.getArgument(0))));
        when(resourceIdResolver.forName(anyString(), any(), anyString(), any(), any()))
                .thenThrow(new MappingNotFoundException());
        when(architectures.getArchitectureForVersion(anyString(), any(), anyString()))
                .thenThrow(new ArchitectureNotFoundException());
        when(conventions.resolveDefault(any(), any())).thenReturn(Optional.empty());
    }

    @Test
    void send_the_document_and_the_detailed_architectures_on_this_hub_in_the_same_namespace_only() throws Exception {
        stored(7, "1.0.0", """
                {"nodes": [
                  {"unique-id": "a", "details": {"detailed-architecture": "https://hub.example.com/calm/namespaces/finos/architectures/8/versions/1.0.0"}},
                  {"unique-id": "b", "details": {"detailed-architecture": "/calm/namespaces/finos/architectures/shop-api/versions/2.0.0"}},
                  {"unique-id": "c", "details": {"detailed-architecture": "https://hub.example.com/calm/namespaces/secret/architectures/9/versions/1.0.0"}},
                  {"unique-id": "d", "details": {"detailed-architecture": "https://evil.example.com/calm/namespaces/finos/architectures/8/versions/1.0.0"}}
                ]}""");
        stored(8, "1.0.0", "{\"nodes\": [{\"unique-id\": \"a1\"}]}");
        stored(12, "2.0.0", "{\"nodes\": [{\"unique-id\": \"b1\"}]}");
        stored(9, "1.0.0", "{\"nodes\": [{\"unique-id\": \"secret\"}]}");
        doReturn(new NumericResourceId(12)).when(resourceIdResolver)
                .forName("finos", ResourceType.ARCHITECTURE, "shop-api", null, null);

        JsonObject body = body(ALL, "version=1.0.0");

        assertThat(body.getJsonObject("document").getJsonArray("nodes").size(), is(4));
        assertThat(body.getJsonObject("linked").fieldNames(), containsInAnyOrder(
                "https://hub.example.com/calm/namespaces/finos/architectures/8/versions/1.0.0",
                "/calm/namespaces/finos/architectures/shop-api/versions/2.0.0"));
        assertThat(body.getValue("conventions"), nullValue());
    }

    @Test
    void send_the_convention_default_with_each_hub_convention_that_it_extends_that_the_caller_can_read() throws Exception {
        stored(7, "1.0.0", "{\"nodes\": []}");
        when(conventions.resolveDefault("finos", ConventionType.C4_MAPPING)).thenReturn(Optional.of(new ResolvedConventionDefault(
                "c4-mapping", "finos", 3, "1.0.0", false,
                json("{\"unique-id\": \"team\", \"extends\": \"/api/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0\"}"))));
        when(permissions.canRead(alice, "org")).thenReturn(true);
        when(conventions.getConventionForVersion(eq("org"), eq(ConventionType.C4_MAPPING),
                eq(new NumericResourceId(1)), eq("1.0.0"))).thenReturn(
                "{\"unique-id\": \"org\", \"extends\": \"/api/calm/namespaces/secret/conventions/c4-mapping/2/versions/1.0.0\"}");
        when(conventions.getConventionForVersion(eq("secret"), eq(ConventionType.C4_MAPPING),
                eq(new NumericResourceId(2)), eq("1.0.0"))).thenReturn("{\"unique-id\": \"secret\"}");

        JsonObject body = body(ALL, "version=1.0.0");

        JsonObject mapping = body.getJsonObject("conventions").getJsonObject("c4-mapping");
        assertThat(mapping.getInteger("conventionId"), is(3));
        assertThat(mapping.getJsonObject("convention").getString("unique-id"), is("team"));
        // The caller cannot read the namespace secret, so Hub stops the chain there.
        assertThat(body.getJsonObject("linked").fieldNames(), containsInAnyOrder(
                "/api/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0"));
    }

    @Test
    void refuse_a_request_with_no_version_or_for_a_version_that_does_not_exist() {
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(ALL, "level=context")).status(), is(400));
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(ALL, "version=..%2F")).status(), is(400));
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(ALL, "version=2.0.0")).status(), is(404));
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(ALL, "version=%zz")).status(), is(400));
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(ALL, "a%zz=1&version=1.0.0")).status(), is(400));
    }

    @Test
    void send_the_document_of_a_pattern_and_refuse_another_resource_type() throws Exception {
        doReturn("{\"unique-id\": \"p\"}").when(patterns).getPatternForVersion("finos",
                new NumericResourceId(4), "1.0.0");
        Map<String, String> pattern = Map.of("namespace", "finos", "resourceType", "patterns", "resourceId", "4");
        Map<String, String> flow = Map.of("namespace", "finos", "resourceType", "flows", "resourceId", "4");

        assertThat(body(DOCUMENT, pattern, "version=1.0.0").getJsonObject("document").getString("unique-id"), is("p"));
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(DOCUMENT, flow, "version=1.0.0")).status(), is(400));
        assertThat(assertThrows(ExtensionProxyException.class, () -> body(DOCUMENT, PATH, null)).status(), is(400));
    }

    @Test
    void answer_not_found_for_a_document_that_is_not_a_json_object() throws Exception {
        stored(7, "1.0.0", "[1, 2]");

        assertThat(assertThrows(ExtensionProxyException.class, () -> body(ALL, "version=1.0.0")).status(), is(404));
    }

    @Test
    void send_no_detailed_architectures_when_the_nodes_are_not_a_list() throws Exception {
        stored(7, "1.0.0", "{\"nodes\": {\"a\": {}}}");

        assertThat(body(ALL, "version=1.0.0").getValue("linked"), nullValue());
    }

    @Test
    void send_at_most_fifty_detailed_architectures_and_skip_nodes_with_no_valid_link() throws Exception {
        StringBuilder nodes = new StringBuilder("{\"unique-id\": \"plain\"}, ")
                .append("{\"unique-id\": \"bad\", \"details\": {\"detailed-architecture\": \"https://hub example.com/x\"}}");
        for (int id = 100; id < 100 + ExtensionHubData.MAX_DETAILED_ARCHITECTURES + 1; id++) {
            nodes.append(", {\"unique-id\": \"n").append(id).append("\", \"details\": {\"detailed-architecture\": ")
                    .append("\"/calm/namespaces/finos/architectures/").append(id).append("/versions/1.0.0\"}}");
            stored(id, "1.0.0", "{}");
        }
        stored(7, "1.0.0", "{\"nodes\": [" + nodes + "]}");

        JsonObject linked = body(ALL, "version=1.0.0").getJsonObject("linked");

        assertThat(linked.size(), is(ExtensionHubData.MAX_DETAILED_ARCHITECTURES));
        assertThat(linked.containsKey("/calm/namespaces/finos/architectures/150/versions/1.0.0"), is(false));
    }

    @Test
    void send_the_convention_default_alone_when_its_extends_chain_cannot_be_followed() throws Exception {
        stored(7, "1.0.0", "{\"nodes\": []}");
        when(permissions.canRead(any(), any())).thenReturn(true);
        when(conventions.getConventionForVersion(eq("missing"), eq(ConventionType.C4_MAPPING),
                eq(new NumericResourceId(1)), eq("1.0.0"))).thenThrow(new RuntimeException("not found"));
        for (String link : List.of(
                "https://other.example.com/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0",
                "/calm/namespaces/org/conventions/other-type/1/versions/1.0.0",
                "/calm/namespaces/missing/conventions/c4-mapping/1/versions/1.0.0")) {
            when(conventions.resolveDefault("finos", ConventionType.C4_MAPPING)).thenReturn(Optional.of(new ResolvedConventionDefault(
                    "c4-mapping", "finos", 3, "1.0.0", false, json("{\"unique-id\": \"team\", \"extends\": \"" + link + "\"}"))));

            JsonObject body = body(ALL, "version=1.0.0");

            assertThat(link, body.getJsonObject("conventions").getJsonObject("c4-mapping").getInteger("conventionId"), is(3));
            assertThat(link, body.getValue("linked"), nullValue());
        }
    }

    @Test
    void follow_an_extends_chain_to_its_end_and_send_no_convention_when_the_default_does_not_load() throws Exception {
        stored(7, "1.0.0", "{\"nodes\": []}");
        when(permissions.canRead(alice, "org")).thenReturn(true);
        when(conventions.resolveDefault("finos", ConventionType.C4_MAPPING)).thenReturn(Optional.of(new ResolvedConventionDefault(
                "c4-mapping", "finos", 3, "1.0.0", false,
                json("{\"unique-id\": \"team\", \"extends\": \"/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0\"}"))));
        when(conventions.getConventionForVersion(eq("org"), eq(ConventionType.C4_MAPPING),
                eq(new NumericResourceId(1)), eq("1.0.0"))).thenReturn("{\"unique-id\": \"org\"}");

        assertThat(body(ALL, "version=1.0.0").getJsonObject("linked").fieldNames(), containsInAnyOrder(
                "/calm/namespaces/org/conventions/c4-mapping/1/versions/1.0.0"));

        when(conventions.resolveDefault("finos", ConventionType.C4_MAPPING)).thenThrow(new RuntimeException("store down"));
        assertThat(body(ALL, "version=1.0.0").getValue("conventions"), nullValue());
    }

    @Test
    void take_the_hub_base_url_from_the_configuration() {
        Config config = mock(Config.class);
        when(config.getOptionalValue("calm.hub.base-url", String.class)).thenReturn(Optional.of("https://calm.example.com"));
        Config none = mock(Config.class);
        when(none.getOptionalValue("calm.hub.base-url", String.class)).thenReturn(Optional.empty());

        ExtensionHubData configured = new ExtensionHubData(architectures, patterns, conventions, permissions, config, resourceIdResolver);
        ExtensionHubData local = new ExtensionHubData(architectures, patterns, conventions, permissions, none, resourceIdResolver);

        assertThat(configured.hubPath("https://calm.example.com/calm/x"), is(Optional.of("/calm/x")));
        assertThat(configured.hubPath("http://localhost:8080/calm/x").stream().toList(), empty());
        assertThat(local.hubPath("http://localhost:8080/calm/x"), is(Optional.of("/calm/x")));
    }

    private JsonObject body(Route route, String query) {
        return body(route, PATH, query);
    }

    private JsonObject body(Route route, Map<String, String> path, String query) {
        return new JsonObject(new String(hubData.body(alice, route, path, query), StandardCharsets.UTF_8));
    }

    private void stored(int id, String version, String json) throws Exception {
        doReturn(json).when(architectures).getArchitectureForVersion("finos",
                new NumericResourceId(id), version);
    }

    private static jakarta.json.JsonObject json(String text) {
        return Json.createReader(new StringReader(text)).readObject();
    }
}
