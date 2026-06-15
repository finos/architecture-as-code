package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.*;
import org.finos.calm.domain.controls.ControlConfigDetail;
import org.finos.calm.domain.controls.ControlDetail;
import org.finos.calm.domain.controls.CreateControlConfiguration;
import org.finos.calm.domain.controls.CreateControlRequirement;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.flow.CreateFlowRequest;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.store.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import org.finos.calm.security.CalmHubPermissionChecker;

import java.util.Collections;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link MappingControllerResource}.
 * No calm.hub.base-url is set, so the resource uses its default of {@code http://localhost:8080};
 * every POST body therefore carries a "$id" matching that canonical URL.
 */
@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestMappingControllerResourceShould {

    @InjectMock ResourceMappingStore mockMappingStore;
    @InjectMock PatternStore mockPatternStore;
    @InjectMock ArchitectureStore mockArchitectureStore;
    @InjectMock FlowStore mockFlowStore;
    @InjectMock StandardStore mockStandardStore;
    @InjectMock InterfaceStore mockInterfaceStore;
    @InjectMock DomainStore mockDomainStore;
    @InjectMock ControlStore mockControlStore;
    @InjectMock CalmHubPermissionChecker mockPermissionChecker;

    @org.junit.jupiter.api.BeforeEach
    void allowWritesByDefault() {
        when(mockPermissionChecker.canWrite(any(), any())).thenReturn(true);
        when(mockPermissionChecker.canWriteByDomain(any(), any())).thenReturn(true);
    }

    /** Builds a document whose {@code $id} matches the versioned canonical URL for the resource, including a title. */
    private static String versionedDoc(String namespace, String type, String name, String version) {
        return "{\"$id\":\"http://localhost:8080/calm/namespaces/"
                + namespace + "/" + type + "/" + name + "/versions/" + version + "\","
                + "\"title\":\"Test Resource\"}";
    }

    // --- POST create new ---

    @Test
    void return_201_when_creating_a_new_pattern_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"))).thenReturn(pattern);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "api-gateway", 1);
    }

    @Test
    void return_201_when_creating_a_new_architecture_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-arch")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-arch"), eq(ResourceType.ARCHITECTURE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-arch")
                        .setResourceType(ResourceType.ARCHITECTURE).setNumericId(0).build());
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(2).setVersion("1.0.0").setArchitecture("{}").build();
        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class))).thenReturn(arch);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "architectures", "my-arch", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/architectures/my-arch/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-arch", 2);
    }

    @Test
    void return_201_when_creating_a_new_flow_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-flow")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-flow"), eq(ResourceType.FLOW), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-flow")
                        .setResourceType(ResourceType.FLOW).setNumericId(0).build());
        Flow flow = new Flow.FlowBuilder()
                .setNamespace("finos").setId(5).setVersion("1.0.0").setFlow("{}").build();
        when(mockFlowStore.createFlowForNamespace(any(CreateFlowRequest.class), eq("finos"))).thenReturn(flow);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "flows", "my-flow", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/flows/my-flow/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-flow", 5);
    }

    @Test
    void return_201_when_creating_a_new_standard_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-standard")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-standard"), eq(ResourceType.STANDARD), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-standard")
                        .setResourceType(ResourceType.STANDARD).setNumericId(0).build());
        Standard standard = new Standard("", "", "{}", 3, "1.0.0");
        standard.setNamespace("finos");
        when(mockStandardStore.createStandardForNamespace(any(CreateStandardRequest.class), eq("finos"))).thenReturn(standard);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "standards", "my-standard", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/standards/my-standard/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-standard", 3);
    }

    @Test
    void return_201_when_creating_a_new_interface_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-interface")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-interface"), eq(ResourceType.INTERFACE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-interface")
                        .setResourceType(ResourceType.INTERFACE).setNumericId(0).build());
        CalmInterface iface = new CalmInterface("", "", "{}", 4, "1.0.0");
        iface.setNamespace("finos");
        when(mockInterfaceStore.createInterfaceForNamespace(any(CreateInterfaceRequest.class), eq("finos"))).thenReturn(iface);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "interfaces", "my-interface", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/interfaces/my-interface/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-interface", 4);
    }

    @Test
    void return_400_when_type_is_invalid_in_document_id() {
        given().header("Content-Type", "application/json")
                .body("{\"$id\":\"http://localhost:8080/calm/namespaces/finos/bananas/api-gateway/versions/1.0.0\"}").when()
                .post("/calm")
                .then().statusCode(400).body(containsString("Unsupported resource type"));
    }

    @Test
    void return_400_when_name_is_reserved_word_versions() {
        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "versions", "1.0.0")).when()
                .post("/calm/namespaces/finos/patterns/versions/versions/1.0.0")
                .then().statusCode(400).body(containsString("reserved"));
    }

    @Test
    void return_400_when_name_format_is_invalid() {
        given().header("Content-Type", "application/json").body("{}").when()
                .post("/calm/namespaces/finos/patterns/INVALID_ID/versions/1.0.0")
                .then().statusCode(400);
    }

    @Test
    void return_404_when_namespace_not_found_on_create() throws Exception {
        when(mockMappingStore.getMapping("invalid", "test-resource")).thenThrow(new NamespaceNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("invalid", "patterns", "test-resource", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(404);
    }

    @Test
    void return_409_when_duplicate_name_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "dup-id")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("dup-id"), eq(ResourceType.PATTERN), eq(0)))
                .thenThrow(new DuplicateMappingException());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "dup-id", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(409).body(containsString("already exists"));
    }

    @Test
    void rollback_mapping_when_store_creation_fails() throws Exception {
        when(mockMappingStore.getMapping("finos", "fail-create")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("fail-create"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("fail-create")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos")))
                .thenThrow(new RuntimeException("Store failure"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "fail-create", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(400);

        verify(mockMappingStore).deleteMapping("finos", "fail-create");
    }

    @Test
    void rollback_mapping_even_when_rollback_itself_fails() throws Exception {
        when(mockMappingStore.getMapping("finos", "rollback-me")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("rollback-me"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("rollback-me")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos")))
                .thenThrow(new RuntimeException("store failure"));
        doThrow(new RuntimeException("rollback failed")).when(mockMappingStore).deleteMapping("finos", "rollback-me");

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "rollback-me", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(400);

        verify(mockMappingStore).deleteMapping("finos", "rollback-me");
    }

    // --- POST /calm adding explicit version to existing resource ---

    @Test
    void return_201_when_adding_explicit_version_to_existing_pattern() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "api-gateway", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0"));
    }

    @Test
    void return_201_when_adding_explicit_version_to_existing_architecture() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "architectures", "my-arch", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/architectures/my-arch/versions/2.0.0"));

        verify(mockArchitectureStore).createArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void return_201_when_adding_explicit_version_to_existing_flow() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-flow")
                .setResourceType(ResourceType.FLOW).setNumericId(5).build();
        when(mockMappingStore.getMapping("finos", "my-flow")).thenReturn(existing);
        when(mockFlowStore.getFlowVersions(any(Flow.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "flows", "my-flow", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/flows/my-flow/versions/2.0.0"));

        verify(mockFlowStore).createFlowForVersion(any(Flow.class));
    }

    @Test
    void return_201_when_adding_explicit_version_to_existing_standard() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard")
                .setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(existing);
        when(mockStandardStore.getStandardVersions("finos", 3)).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "standards", "my-standard", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/standards/my-standard/versions/2.0.0"));

        verify(mockStandardStore).createStandardForVersion(any(CreateStandardRequest.class), eq("finos"), eq(3), eq("2.0.0"));
    }

    @Test
    void return_201_when_adding_explicit_version_to_existing_interface() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface")
                .setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(existing);
        when(mockInterfaceStore.getInterfaceVersions("finos", 4)).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "interfaces", "my-interface", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/interfaces/my-interface/versions/2.0.0"));

        verify(mockInterfaceStore).createInterfaceForVersion(any(CreateInterfaceRequest.class), eq("finos"), eq(4), eq("2.0.0"));
    }

    @Test
    void return_404_when_existing_mapping_has_no_versions_on_update() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("orphan")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "orphan")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "orphan", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(404);
    }

    @Test
    void return_400_when_update_store_throws_unexpected_exception() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("null-msg")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "null-msg")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.createPatternForVersion(any(Pattern.class))).thenThrow(new RuntimeException((String) null));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "null-msg", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(400).body(containsString("Unknown error"));
    }

    @Test
    void return_404_when_namespace_not_found_on_update() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", "api-gateway")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("badns", "patterns", "api-gateway", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(404);
    }

    // --- POST $id verification ---

    @Test
    void return_400_when_post_body_has_no_id() {
        given().header("Content-Type", "application/json").body("{}").when()
                .post("/calm")
                .then().statusCode(400).body(containsString("$id is required"));
    }

    @Test
    void return_400_when_post_body_id_is_versionless() {
        given().header("Content-Type", "application/json")
                .body("{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/api-gateway\"}").when()
                .post("/calm")
                .then().statusCode(400).body(containsString("must include a version"));
    }

    @Test
    void return_400_when_first_create_requests_non_1_0_0_via_versioned_id() throws Exception {
        when(mockMappingStore.getMapping("finos", "seed-me")).thenThrow(new MappingNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "seed-me", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(400).body(containsString("first version of a resource must be 1.0.0"));
    }

    @Test
    void return_201_when_first_create_uses_versioned_id_of_1_0_0() throws Exception {
        when(mockMappingStore.getMapping("finos", "seed-one")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("seed-one"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("seed-one")
                        .setResourceType(ResourceType.PATTERN).setNumericId(7).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(7).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"))).thenReturn(pattern);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "seed-one", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/seed-one/versions/1.0.0"));
    }

    // --- PUT /calm (disabled by default) ---

    @Test
    void return_403_when_put_is_disabled() {
        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0")).when()
                .put("/calm")
                .then().statusCode(403).body(containsString("does not support PUT"));
    }

    @Test
    void return_400_when_put_body_has_no_id() {
        given().header("Content-Type", "application/json").body("{}").when()
                .put("/calm")
                .then().statusCode(403);
    }

    // --- POST specific version endpoint ---

    @Test
    void return_201_when_creating_specific_version_on_new_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "v-new")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("v-new"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("v-new")
                        .setResourceType(ResourceType.PATTERN).setNumericId(8).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(8).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"))).thenReturn(pattern);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-new", "1.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-new/versions/1.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/v-new/versions/1.0.0"));
    }

    @Test
    void return_400_when_creating_non_1_0_0_specific_version_on_new_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "v-seed")).thenThrow(new MappingNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-seed", "2.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-seed/versions/2.0.0")
                .then().statusCode(400).body(containsString("first version of a resource must be 1.0.0"));
    }

    @Test
    void return_201_when_adding_specific_version_to_existing_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("v-exist")
                .setResourceType(ResourceType.PATTERN).setNumericId(9).build();
        when(mockMappingStore.getMapping("finos", "v-exist")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-exist", "2.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-exist/versions/2.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/v-exist/versions/2.0.0"));

        verify(mockPatternStore).createPatternForVersion(any(Pattern.class));
    }

    @Test
    void return_409_when_specific_version_already_exists() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("v-dup")
                .setResourceType(ResourceType.PATTERN).setNumericId(10).build();
        when(mockMappingStore.getMapping("finos", "v-dup")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0", "2.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-dup", "2.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-dup/versions/2.0.0")
                .then().statusCode(409).body(containsString("already exists"));
    }

    @Test
    void return_400_when_specific_version_id_does_not_match_path_version() throws Exception {
        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-mismatch", "3.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-mismatch/versions/2.0.0")
                .then().statusCode(400).body(containsString("does not match"));
    }

    @Test
    void return_400_when_specific_version_post_has_no_id() {
        given().header("Content-Type", "application/json").body("{}").when()
                .post("/calm/namespaces/finos/patterns/v-no-id/versions/1.0.0")
                .then().statusCode(400).body(containsString("$id is required"));
    }

    // --- GET latest (removed — only explicit versioned GET is supported) ---

    @Test
    void return_400_when_title_is_missing_on_new_resource_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "no-title")).thenThrow(new MappingNotFoundException());
        // Body has $id and version 1.0.0 but NO title field
        String body = "{\"$id\":\"http://localhost:8080/calm/namespaces/finos/patterns/no-title/versions/1.0.0\"}";

        given().header("Content-Type", "application/json").body(body).when()
                .post("/calm")
                .then().statusCode(400).body(containsString("title"));
    }

    // --- GET list versions ---

    @Test
    void return_200_with_version_list() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0", "1.1.0"));

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions")
                .then().statusCode(200)
                .body("values", hasSize(2))
                .body("values[0]", is("1.0.0"))
                .body("values[1]", is("1.1.0"));
    }

    @Test
    void return_versions_sorted_by_semver() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("sorted-test")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "sorted-test")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class)))
                .thenReturn(List.of("2.0.0", "1.0.0", "1.1.0", "1.0.1"));

        given().when().get("/calm/namespaces/finos/patterns/sorted-test/versions")
                .then().statusCode(200)
                .body("values", hasSize(4))
                .body("values[0]", is("1.0.0"))
                .body("values[1]", is("1.0.1"))
                .body("values[2]", is("1.1.0"))
                .body("values[3]", is("2.0.0"));
    }

    @Test
    void return_404_when_mapping_not_found_on_list_versions() throws Exception {
        when(mockMappingStore.getMapping("finos", "nonexistent")).thenThrow(new MappingNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/nonexistent/versions")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_pattern_not_found_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("missing-versions")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "missing-versions")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/missing-versions/versions")
                .then().statusCode(404).body(containsString("missing-versions"));
    }

    @Test
    void return_500_when_unexpected_error_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("err-list-versions")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "err-list-versions")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new RuntimeException("boom"));

        given().when().get("/calm/namespaces/finos/patterns/err-list-versions/versions")
                .then().statusCode(500);
    }

    @Test
    void verify_store_called_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions").then().statusCode(200);
        verify(mockPatternStore).getPatternVersions(any(Pattern.class));
    }

    // --- GET specific version ---

    @Test
    void return_200_for_specific_pattern_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{\"version\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_architecture_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(mapping);
        when(mockArchitectureStore.getArchitectureForVersion(any(Architecture.class))).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/architectures/my-arch/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_flow_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-flow")
                .setResourceType(ResourceType.FLOW).setNumericId(5).build();
        when(mockMappingStore.getMapping("finos", "my-flow")).thenReturn(mapping);
        when(mockFlowStore.getFlowForVersion(any(Flow.class))).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/flows/my-flow/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_standard_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard")
                .setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(mapping);
        when(mockStandardStore.getStandardForVersion("finos", 3, "1.0.0")).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/standards/my-standard/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_interface_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface")
                .setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(mapping);
        when(mockInterfaceStore.getInterfaceForVersion("finos", 4, "1.0.0")).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/interfaces/my-interface/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_404_when_mapping_not_found_on_get_version() throws Exception {
        when(mockMappingStore.getMapping("finos", "nonexistent")).thenThrow(new MappingNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/nonexistent/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_version_not_found_for_specific_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new PatternVersionNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/9.9.9")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_pattern_not_found_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("missing-pattern")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "missing-pattern")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/missing-pattern/versions/1.0.0")
                .then().statusCode(404).body(containsString("missing-pattern"));
    }

    @Test
    void return_404_when_namespace_not_found_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        given().when().get("/calm/namespaces/badns/patterns/api-gateway/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_500_when_unexpected_error_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("err-version")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "err-version")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new RuntimeException("boom"));

        given().when().get("/calm/namespaces/finos/patterns/err-version/versions/1.0.0")
                .then().statusCode(500);
    }

    @Test
    void verify_store_called_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{}");

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0").then().statusCode(200);
        verify(mockPatternStore).getPatternForVersion(any(Pattern.class));
    }

    // --- GET list resources of type ---

    @Test
    void return_200_with_all_patterns_for_namespace() throws Exception {
        ResourceMapping m1 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        ResourceMapping m2 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("event-bus")
                .setResourceType(ResourceType.PATTERN).setNumericId(2).build();
        when(mockMappingStore.listMappings("finos", ResourceType.PATTERN)).thenReturn(List.of(m1, m2));

        given().when().get("/calm/namespaces/finos/patterns")
                .then().statusCode(200).body("values", hasSize(2));
    }

    @Test
    void return_400_when_list_type_is_invalid() {
        given().when().get("/calm/namespaces/finos/bananas")
                .then().statusCode(400).body(containsString("Unsupported resource type"));
    }

    @Test
    void return_404_when_namespace_not_found_on_list() throws Exception {
        when(mockMappingStore.listMappings("invalid", ResourceType.PATTERN))
                .thenThrow(new NamespaceNotFoundException());

        given().when().get("/calm/namespaces/invalid/patterns")
                .then().statusCode(404);
    }

    // =========================================================================
    // User Facing API — Domains
    // =========================================================================

    @Test
    void return_200_with_empty_domain_list_when_no_domains_exist() {
        when(mockDomainStore.getDomains()).thenReturn(List.of());

        given().when().get("/calm/domains")
                .then().statusCode(200).body("values", hasSize(0));

        verify(mockDomainStore).getDomains();
    }

    @Test
    void return_200_with_domain_list_when_domains_exist() {
        when(mockDomainStore.getDomains()).thenReturn(List.of("security", "payments"));

        given().when().get("/calm/domains")
                .then().statusCode(200)
                .body("values", hasSize(2))
                .body("values[0]", equalTo("security"))
                .body("values[1]", equalTo("payments"));

        verify(mockDomainStore).getDomains();
    }

    @Test
    void return_201_when_creating_a_new_domain() throws DomainAlreadyExistsException {
        when(mockDomainStore.createDomain("risk")).thenReturn(new Domain("risk"));

        given().header("Content-Type", "application/json")
                .body("{\"name\":\"risk\"}")
                .when().post("/calm/domains")
                .then().statusCode(201)
                .header("Location", containsString("/calm/domains/risk"));

        verify(mockDomainStore).createDomain("risk");
    }

    @Test
    void return_409_when_creating_a_domain_that_already_exists() throws DomainAlreadyExistsException {
        when(mockDomainStore.createDomain("risk")).thenThrow(new DomainAlreadyExistsException("already exists"));

        given().header("Content-Type", "application/json")
                .body("{\"name\":\"risk\"}")
                .when().post("/calm/domains")
                .then().statusCode(409);
    }

    // =========================================================================
    // User Facing API — Controls (name-based resolution)
    // =========================================================================

    @Test
    void return_200_with_controls_for_valid_domain() throws DomainNotFoundException {
        ControlDetail detail = new ControlDetail(1, "access-control", "Ensure access control");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));

        given().when().get("/calm/domains/security/controls")
                .then().statusCode(200)
                .body("values", hasSize(1))
                .body("values[0].name", equalTo("access-control"));

        verify(mockControlStore).getControlsForDomain("security");
    }

    @Test
    void return_404_when_listing_controls_for_unknown_domain() throws DomainNotFoundException {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));

        given().when().get("/calm/domains/unknown/controls")
                .then().statusCode(404);
    }

    @Test
    void return_201_when_creating_new_control_via_versioned_path_post() throws Exception {
        ControlDetail created = new ControlDetail(42, "new-control", "A new control");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());
        when(mockControlStore.createControlRequirement(any(CreateControlRequirement.class), eq("security")))
                .thenReturn(created);

        // No base URL override — default is http://localhost:8080
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/new-control/requirement/versions/1.0.0\","
                + "\"description\":\"A new control\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/new-control/requirement/versions/1.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/domains/security/controls/new-control/requirement/versions/1.0.0"));
    }

    @Test
    void return_400_when_versioned_path_post_id_mismatches_path() throws Exception {
        // $id references a different control name than the path
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/other-control/requirement/versions/1.0.0\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/new-control/requirement/versions/1.0.0")
                .then().statusCode(400)
                .body(containsString("does not match"));
    }

    @Test
    void return_400_when_versioned_path_post_has_no_id() throws Exception {
        given().header("Content-Type", "application/json")
                .body("{\"description\":\"no id\"}")
                .when().post("/calm/domains/security/controls/new-control/requirement/versions/1.0.0")
                .then().statusCode(400)
                .body(containsString("$id"));
    }

    @Test
    void return_400_when_versioned_path_post_first_version_is_not_1_0_0() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/new-control/requirement/versions/2.0.0\","
                + "\"description\":\"A new control\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/new-control/requirement/versions/2.0.0")
                .then().statusCode(400)
                .body(containsString("first version"));
    }

    @Test
    void return_201_when_adding_version_to_existing_control_via_versioned_path_post() throws Exception {
        ControlDetail existing = new ControlDetail(5, "new-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(existing));

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/new-control/requirement/versions/2.0.0\","
                + "\"description\":\"Updated\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/new-control/requirement/versions/2.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/domains/security/controls/new-control/requirement/versions/2.0.0"));
    }

    @Test
    void return_201_when_creating_new_config_via_versioned_path_post() throws Exception {
        ControlDetail control = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(control));
        // Empty list → resolveConfigId throws ControlConfigurationNotFoundException → new config path
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(Collections.emptyList());
        when(mockControlStore.createControlConfiguration(any(CreateControlConfiguration.class), eq("security"), eq(5)))
                .thenReturn(99);

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/configurations/tls-config/versions/1.0.0\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/configurations/tls-config/versions/1.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/domains/security/controls/access-control/configurations/tls-config/versions/1.0.0"));
    }

    @Test
    void return_201_when_adding_version_to_existing_config_via_versioned_path_post() throws Exception {
        ControlDetail control = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(control));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(99, "tls-config")));

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0"));
    }

    @Test
    void return_404_when_creating_control_for_unknown_domain() throws DomainNotFoundException {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/unknown/controls/new-control/requirement/versions/1.0.0\","
                + "\"description\":\"A new control\"}";

        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/unknown/controls/new-control/requirement/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_200_with_requirement_versions_resolved_by_control_name() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getRequirementVersions("security", 5)).thenReturn(List.of("1.0.0", "2.0.0"));

        given().when().get("/calm/domains/security/controls/access-control/requirement/versions")
                .then().statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    void return_404_when_control_name_not_found_on_requirement_versions() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of());

        given().when().get("/calm/domains/security/controls/nonexistent/requirement/versions")
                .then().statusCode(404);
    }

    @Test
    void return_200_with_requirement_at_version_resolved_by_control_name() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getRequirementForVersion("security", 5, "1.0.0")).thenReturn("{\"type\":\"req\"}");

        given().when().get("/calm/domains/security/controls/access-control/requirement/versions/1.0.0")
                .then().statusCode(200)
                .body("type", equalTo("req"));
    }

    @Test
    void return_200_with_configurations_resolved_by_control_name() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(
                        new ControlConfigDetail(10, "encryption-config"),
                        new ControlConfigDetail(20, "tls-config")));

        given().when().get("/calm/domains/security/controls/access-control/configurations")
                .then().statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    void return_200_with_configuration_versions_resolved_by_config_name() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "encryption-config")));
        when(mockControlStore.getConfigurationVersions("security", 5, 10)).thenReturn(List.of("1.0.0"));

        given().when().get("/calm/domains/security/controls/access-control/configurations/encryption-config/versions")
                .then().statusCode(200)
                .body("values", hasSize(1));
    }

    @Test
    void return_200_with_configuration_at_version_resolved_by_config_name() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "encryption-config")));
        when(mockControlStore.getConfigurationForVersion("security", 5, 10, "1.0.0")).thenReturn("{\"key\":\"val\"}");

        given().when().get("/calm/domains/security/controls/access-control/configurations/encryption-config/versions/1.0.0")
                .then().statusCode(200)
                .body("key", equalTo("val"));
    }

    @Test
    void return_404_when_configuration_name_not_found() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "encryption-config")));

        given().when().get("/calm/domains/security/controls/access-control/configurations/nonexistent/versions")
                .then().statusCode(404);
    }
}
