package org.finos.calm.extensions;

import io.quarkus.security.identity.SecurityIdentity;
import io.vertx.core.json.JsonObject;
import jakarta.json.Json;
import org.finos.calm.domain.Architecture;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.conventions.ConventionType;
import org.finos.calm.domain.conventions.ResolvedConventionDefault;
import org.finos.calm.domain.exception.ArchitectureNotFoundException;
import org.finos.calm.domain.extensions.ExtensionManifest.Route;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.services.ConventionService;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.PatternStore;
import org.finos.calm.store.ResourceMappingStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TestExtensionHubDataShould {

    private static final Map<String, String> PATH = Map.of("namespace", "finos", "resourceType", "architectures", "resourceId", "7");
    private static final Route ALL = new Route("lens", "POST", "/lens/{namespace}/{resourceType}/{resourceId}", "read", true,
            List.of("document", "detailed-architectures", "c4-mapping"));

    private final ArchitectureStore architectures = mock(ArchitectureStore.class);
    private final ResourceMappingStore mappings = mock(ResourceMappingStore.class);
    private final ConventionService conventions = mock(ConventionService.class);
    private final CalmHubPermissionChecker permissions = mock(CalmHubPermissionChecker.class);
    private final SecurityIdentity alice = mock(SecurityIdentity.class);
    private ExtensionHubData hubData;

    @BeforeEach
    void setup() throws Exception {
        hubData = new ExtensionHubData(architectures, mock(PatternStore.class), mappings, conventions, permissions,
                "https://hub.example.com");
        when(architectures.getArchitectureForVersion(any())).thenThrow(new ArchitectureNotFoundException());
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
        when(mappings.getMapping("finos", ResourceType.ARCHITECTURE, "shop-api")).thenReturn(
                new ResourceMapping.ResourceMappingBuilder().setNumericId(12).build());

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
        when(conventions.getConventionForVersion("org", ConventionType.C4_MAPPING, 1, "1.0.0")).thenReturn(
                "{\"unique-id\": \"org\", \"extends\": \"/api/calm/namespaces/secret/conventions/c4-mapping/2/versions/1.0.0\"}");
        when(conventions.getConventionForVersion("secret", ConventionType.C4_MAPPING, 2, "1.0.0")).thenReturn("{\"unique-id\": \"secret\"}");

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

    private JsonObject body(Route route, String query) {
        return new JsonObject(new String(hubData.body(alice, route, PATH, query), StandardCharsets.UTF_8));
    }

    private void stored(int id, String version, String json) throws Exception {
        doReturn(json).when(architectures).getArchitectureForVersion(argThat((Architecture a) -> a != null && a.getId() == id
                && version.equals(a.getDotVersion()) && "finos".equals(a.getNamespace())));
    }

    private static jakarta.json.JsonObject json(String text) {
        return Json.createReader(new StringReader(text)).readObject();
    }
}
