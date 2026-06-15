package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.*;
import org.finos.calm.store.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import org.finos.calm.security.CalmHubPermissionChecker;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests for {@code PUT /calm} with {@code allow.put.operations=true}.
 */
@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@TestProfile(AllowPutProfile.class)
@ExtendWith(MockitoExtension.class)
public class TestMappingControllerResourcePutShould {

    @InjectMock ResourceMappingStore mockMappingStore;
    @InjectMock PatternStore mockPatternStore;
    @InjectMock ArchitectureStore mockArchitectureStore;
    @InjectMock FlowStore mockFlowStore;
    @InjectMock StandardStore mockStandardStore;
    @InjectMock InterfaceStore mockInterfaceStore;
    @InjectMock CalmHubPermissionChecker mockPermissionChecker;

    @org.junit.jupiter.api.BeforeEach
    void allowWritesByDefault() {
        when(mockPermissionChecker.canWrite(any(), any())).thenReturn(true);
        when(mockPermissionChecker.canWriteByDomain(any(), any())).thenReturn(true);
    }

    private static String versionedDoc(String namespace, String type, String name, String version) {
        return "{\"$id\":\"http://localhost:8080/calm/namespaces/"
                + namespace + "/" + type + "/" + name + "/versions/" + version + "\"}";
    }

    @Test
    void return_201_when_updating_existing_pattern() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));

        verify(mockPatternStore).updatePatternForVersion(any(Pattern.class));
    }

    @Test
    void return_201_when_updating_existing_architecture() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(existing);

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "my-arch", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/architectures/my-arch/versions/1.0.0"));

        verify(mockArchitectureStore).updateArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void return_201_when_updating_existing_flow() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-flow")
                .setResourceType(ResourceType.FLOW).setNumericId(5).build();
        when(mockMappingStore.getMapping("finos", "my-flow")).thenReturn(existing);

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "flows", "my-flow", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/flows/my-flow/versions/1.0.0"));

        verify(mockFlowStore).updateFlowForVersion(any(Flow.class));
    }

    @Test
    void return_501_when_updating_standard() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard")
                .setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(existing);

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "standards", "my-standard", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(501).body(containsString("not supported"));
    }

    @Test
    void return_501_when_updating_interface() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface")
                .setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(existing);

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "interfaces", "my-interface", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(501).body(containsString("not supported"));
    }

    @Test
    void return_404_when_mapping_not_found_on_put() throws Exception {
        when(mockMappingStore.getMapping("finos", "nonexistent")).thenThrow(new MappingNotFoundException());

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "nonexistent", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(404).body(containsString("nonexistent"));
    }

    @Test
    void return_400_when_put_body_has_no_id() {
        given().header("Content-Type", "application/json").body("{}").when()
                .put("/calm")
                .then().statusCode(400).body(containsString("$id is required"));
    }

    @Test
    void return_404_when_namespace_not_found_on_put() throws Exception {
        when(mockMappingStore.getMapping("invalid", "api-gateway")).thenThrow(new NamespaceNotFoundException());

        given().header("Content-Type", "application/json")
                .body(versionedDoc("invalid", "patterns", "api-gateway", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(404);
    }

    @Test
    void return_400_when_put_body_is_blank() {
        given().header("Content-Type", "application/json")
                .body("   ")
                .when().put("/calm")
                .then().statusCode(400).body(containsString("Invalid JSON"));
    }

    @Test
    void return_400_when_put_body_is_invalid_json() {
        given().header("Content-Type", "application/json")
                .body("{invalid-json")
                .when().put("/calm")
                .then().statusCode(400);
    }

    @Test
    void return_403_when_put_is_forbidden_for_namespace() {
        when(mockPermissionChecker.canWrite(any(), eq("finos"))).thenReturn(false);
        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0"))
                .when().put("/calm")
                .then().statusCode(403).body(containsString("finos"));
    }

    @Test
    void return_404_when_namespace_not_found_during_update_store_call() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);
        doThrow(new NamespaceNotFoundException()).when(mockPatternStore)
                .updatePatternForVersion(any(Pattern.class));
        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0"))
                .when().put("/calm")
                .then().statusCode(404);
    }

    @Test
    void return_500_when_unexpected_error_during_update() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);
        doThrow(new RuntimeException("unexpected store failure")).when(mockPatternStore)
                .updatePatternForVersion(any(Pattern.class));
        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0"))
                .when().put("/calm")
                .then().statusCode(500);
    }
}
