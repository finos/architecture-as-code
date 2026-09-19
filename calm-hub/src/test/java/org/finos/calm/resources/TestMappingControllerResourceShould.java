package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.*;
import org.finos.calm.domain.audit.AuditAction;
import org.finos.calm.domain.audit.AuditLogEntry;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.junit.jupiter.MockitoExtension;

import org.finos.calm.security.AuditService;
import org.finos.calm.security.CalmHubPermissionChecker;

import java.util.Collections;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
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
    @InjectMock AuditService mockAuditService;

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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"), eq("1.0.0"))).thenReturn(pattern);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "api-gateway", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", ResourceType.PATTERN, "api-gateway", 1);
    }

    @Test
    void return_201_when_creating_a_new_architecture_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "my-arch")).thenThrow(new MappingNotFoundException());
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

        verify(mockMappingStore).updateMappingNumericId("finos", ResourceType.ARCHITECTURE, "my-arch", 2);
    }

    @Test
    void return_201_when_creating_a_new_flow_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.FLOW, "my-flow")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-flow"), eq(ResourceType.FLOW), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-flow")
                        .setResourceType(ResourceType.FLOW).setNumericId(0).build());
        Flow flow = new Flow.FlowBuilder()
                .setNamespace("finos").setId(5).setVersion("1.0.0").setFlow("{}").build();
        when(mockFlowStore.createFlowForNamespace(any(CreateFlowRequest.class), eq("finos"), eq("1.0.0"))).thenReturn(flow);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "flows", "my-flow", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/flows/my-flow/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", ResourceType.FLOW, "my-flow", 5);
    }

    @Test
    void return_201_when_creating_a_new_standard_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.STANDARD, "my-standard")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-standard"), eq(ResourceType.STANDARD), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-standard")
                        .setResourceType(ResourceType.STANDARD).setNumericId(0).build());
        Standard standard = new Standard("", "", "{}", 3, "1.0.0");
        standard.setNamespace("finos");
        when(mockStandardStore.createStandardForNamespace(any(CreateStandardRequest.class), eq("finos"), eq("1.0.0"))).thenReturn(standard);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "standards", "my-standard", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/standards/my-standard/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", ResourceType.STANDARD, "my-standard", 3);
    }

    @Test
    void return_201_when_creating_a_new_interface_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.INTERFACE, "my-interface")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("my-interface"), eq(ResourceType.INTERFACE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-interface")
                        .setResourceType(ResourceType.INTERFACE).setNumericId(0).build());
        CalmInterface iface = new CalmInterface("", "", "{}", 4, "1.0.0");
        iface.setNamespace("finos");
        when(mockInterfaceStore.createInterfaceForNamespace(any(CreateInterfaceRequest.class), eq("finos"), eq("1.0.0"))).thenReturn(iface);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "interfaces", "my-interface", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/interfaces/my-interface/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", ResourceType.INTERFACE, "my-interface", 4);
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
        when(mockMappingStore.getMapping("invalid", ResourceType.PATTERN, "test-resource")).thenThrow(new NamespaceNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("invalid", "patterns", "test-resource", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(404);
    }

    @Test
    void return_409_when_duplicate_name_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "dup-id")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("dup-id"), eq(ResourceType.PATTERN), eq(0)))
                .thenThrow(new DuplicateMappingException());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "dup-id", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(409).body(containsString("already exists"));
    }

    @Test
    void rollback_mapping_when_store_creation_fails() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "fail-create")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("fail-create"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("fail-create")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"), eq("1.0.0")))
                .thenThrow(new RuntimeException("Store failure"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "fail-create", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(400);

        verify(mockMappingStore).deleteMapping("finos", ResourceType.PATTERN, "fail-create");
    }

    @Test
    void rollback_mapping_even_when_rollback_itself_fails() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "rollback-me")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("rollback-me"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("rollback-me")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"), eq("1.0.0")))
                .thenThrow(new RuntimeException("store failure"));
        doThrow(new RuntimeException("rollback failed")).when(mockMappingStore).deleteMapping("finos", ResourceType.PATTERN, "rollback-me");

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "rollback-me", "1.0.0")).when()
                .post("/calm")
                .then().statusCode(400);

        verify(mockMappingStore).deleteMapping("finos", ResourceType.PATTERN, "rollback-me");
    }

    // --- POST /calm adding explicit version to existing resource ---

    @Test
    void return_201_when_adding_explicit_version_to_existing_pattern() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "my-arch")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "architectures", "my-arch", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/architectures/my-arch/versions/2.0.0"));

        verify(mockArchitectureStore).createArchitectureForVersion(any(Architecture.class));
    }

    // --- POST snapshot semantics: idempotent create/overwrite, shadow 409 ---

    @Test
    void create_a_snapshot_that_does_not_exist_yet() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "2.0.0-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/2.0.0-SNAPSHOT")
                .then().statusCode(201)
                .header("Location", containsString("/versions/2.0.0-SNAPSHOT"));

        verify(mockArchitectureStore).createArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void overwrite_a_snapshot_that_already_exists() throws Exception {
        // The point of the feature: a client must not have to know whether the snapshot is
        // already there, so a repeat POST is an overwrite rather than a 409.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("2.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "2.0.0-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/2.0.0-SNAPSHOT")
                .then().statusCode(200);

        verify(mockArchitectureStore).updateArchitectureForVersion(any(Architecture.class));
        verify(mockArchitectureStore, never()).createArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void overwrite_a_snapshot_whose_raw_request_spelling_differs_from_the_stored_canonical_spelling() throws Exception {
        // versions holds the canonical spelling ("2.0.0-SNAPSHOT"); the request uses a
        // different accepted spelling ("200-SNAPSHOT") for the same logical version. The
        // create-versus-overwrite decision must canonicalise the raw request before comparing
        // against the stored list, or this lands on the create branch and fails with a 400
        // when the store rejects the duplicate.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("2.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "200-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/200-SNAPSHOT")
                .then().statusCode(200);

        verify(mockArchitectureStore).updateArchitectureForVersion(any(Architecture.class));
        verify(mockArchitectureStore, never()).createArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void refuse_a_snapshot_whose_release_version_is_already_published() throws Exception {
        // A snapshot that shadows a published version makes "promotion deletes the snapshot"
        // ambiguous, so it is refused at the point of creation.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "1.0.0-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/1.0.0-SNAPSHOT")
                .then().statusCode(409);
    }

    @Test
    void refuse_a_snapshot_whose_canonical_spelling_shadows_a_published_release() throws Exception {
        // 100-SNAPSHOT canonicalizes to 1.0.0-SNAPSHOT; its release version (100) must be
        // compared against the stored, canonical spelling of the published release (1.0.0),
        // not the raw request spelling.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "100-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/100-SNAPSHOT")
                .then().statusCode(409);
    }

    @Test
    void still_refuse_a_release_version_that_already_exists() throws Exception {
        // Releases stay immutable. Only the snapshot target is idempotent.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "1.0.0")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/1.0.0")
                .then().statusCode(409);
    }

    @Test
    void refuse_a_release_version_whose_raw_request_spelling_differs_from_the_stored_canonical_spelling() throws Exception {
        // versions holds the canonical spelling ("1.0.0"); the request uses a different
        // accepted spelling ("100") for the same logical release. Without canonicalising the
        // raw request first, this fails to detect the clash, falls through to the create
        // branch and returns a 400 from the store instead of the correct 409.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-test")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-test")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-test", "100")).when()
                .post("/calm/namespaces/finos/architectures/snap-test/versions/100")
                .then().statusCode(409);
    }

    @Test
    void overwrite_a_standard_snapshot_that_already_exists() throws Exception {
        // STANDARD's update arm is only reachable via this snapshot-overwrite path: PUT
        // hard-returns 501 for STANDARD, and the pre-existing STANDARD tests only exercise
        // create. This is the only test that can catch a broken updateStandardForVersion call.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-standard")
                .setResourceType(ResourceType.STANDARD).setNumericId(30).build();
        when(mockMappingStore.getMapping("finos", ResourceType.STANDARD, "snap-standard")).thenReturn(existing);
        when(mockStandardStore.getStandardVersions("finos", 30)).thenReturn(List.of("2.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "standards", "snap-standard", "2.0.0-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/standards/snap-standard/versions/2.0.0-SNAPSHOT")
                .then().statusCode(200);

        verify(mockStandardStore).updateStandardForVersion(any(CreateStandardRequest.class), eq("finos"), eq(30), eq("2.0.0-SNAPSHOT"));
        verify(mockStandardStore, never()).createStandardForVersion(any(CreateStandardRequest.class), any(), any(), any());
    }

    @Test
    void overwrite_an_interface_snapshot_that_already_exists() throws Exception {
        // Same rationale as the STANDARD case above: PUT hard-returns 501 for INTERFACE too,
        // so this snapshot-overwrite path is the only caller reaching updateInterfaceForVersion.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snap-interface")
                .setResourceType(ResourceType.INTERFACE).setNumericId(40).build();
        when(mockMappingStore.getMapping("finos", ResourceType.INTERFACE, "snap-interface")).thenReturn(existing);
        when(mockInterfaceStore.getInterfaceVersions("finos", 40)).thenReturn(List.of("2.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "interfaces", "snap-interface", "2.0.0-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/interfaces/snap-interface/versions/2.0.0-SNAPSHOT")
                .then().statusCode(200);

        verify(mockInterfaceStore).updateInterfaceForVersion(any(CreateInterfaceRequest.class), eq("finos"), eq(40), eq("2.0.0-SNAPSHOT"));
        verify(mockInterfaceStore, never()).createInterfaceForVersion(any(CreateInterfaceRequest.class), any(), any(), any());
    }

    @Test
    void return_201_when_adding_explicit_version_to_existing_flow() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-flow")
                .setResourceType(ResourceType.FLOW).setNumericId(5).build();
        when(mockMappingStore.getMapping("finos", ResourceType.FLOW, "my-flow")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.STANDARD, "my-standard")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.INTERFACE, "my-interface")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "orphan")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "null-msg")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("badns", ResourceType.PATTERN, "api-gateway")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "seed-me")).thenThrow(new MappingNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "seed-me", "2.0.0")).when()
                .post("/calm")
                .then().statusCode(400).body(containsString("first version of a resource must be 1.0.0"));
    }

    @Test
    void return_201_when_first_create_uses_versioned_id_of_1_0_0() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "seed-one")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("seed-one"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("seed-one")
                        .setResourceType(ResourceType.PATTERN).setNumericId(7).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(7).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"), eq("1.0.0"))).thenReturn(pattern);

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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "v-new")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("v-new"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("v-new")
                        .setResourceType(ResourceType.PATTERN).setNumericId(8).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(8).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"), eq("1.0.0"))).thenReturn(pattern);

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-new", "1.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-new/versions/1.0.0")
                .then().statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/patterns/v-new/versions/1.0.0"));
    }

    @Test
    void return_400_when_creating_non_1_0_0_specific_version_on_new_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "v-seed")).thenThrow(new MappingNotFoundException());

        given().header("Content-Type", "application/json").body(versionedDoc("finos", "patterns", "v-seed", "2.0.0")).when()
                .post("/calm/namespaces/finos/patterns/v-seed/versions/2.0.0")
                .then().statusCode(400).body(containsString("first version of a resource must be 1.0.0"));
    }

    @Test
    void return_201_when_adding_specific_version_to_existing_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("v-exist")
                .setResourceType(ResourceType.PATTERN).setNumericId(9).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "v-exist")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "v-dup")).thenReturn(existing);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "no-title")).thenThrow(new MappingNotFoundException());
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenReturn(mapping);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "sorted-test")).thenReturn(mapping);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "nonexistent")).thenThrow(new MappingNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/nonexistent/versions")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_pattern_not_found_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("missing-versions")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "missing-versions")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/missing-versions/versions")
                .then().statusCode(404).body(containsString("missing-versions"));
    }

    @Test
    void return_500_when_unexpected_error_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("err-list-versions")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "err-list-versions")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new RuntimeException("boom"));

        given().when().get("/calm/namespaces/finos/patterns/err-list-versions/versions")
                .then().statusCode(500);
    }

    @Test
    void verify_store_called_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenReturn(mapping);
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
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{\"version\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_architecture_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "my-arch")).thenReturn(mapping);
        when(mockArchitectureStore.getArchitectureForVersion(any(Architecture.class))).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/architectures/my-arch/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_flow_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-flow")
                .setResourceType(ResourceType.FLOW).setNumericId(5).build();
        when(mockMappingStore.getMapping("finos", ResourceType.FLOW, "my-flow")).thenReturn(mapping);
        when(mockFlowStore.getFlowForVersion(any(Flow.class))).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/flows/my-flow/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_standard_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard")
                .setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", ResourceType.STANDARD, "my-standard")).thenReturn(mapping);
        when(mockStandardStore.getStandardForVersion("finos", 3, "1.0.0")).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/standards/my-standard/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_interface_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface")
                .setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", ResourceType.INTERFACE, "my-interface")).thenReturn(mapping);
        when(mockInterfaceStore.getInterfaceForVersion("finos", 4, "1.0.0")).thenReturn("{\"v\": \"1.0.0\"}");

        given().when().get("/calm/namespaces/finos/interfaces/my-interface/versions/1.0.0")
                .then().statusCode(200).body(containsString("1.0.0"));
    }

    @Test
    void return_404_when_mapping_not_found_on_get_version() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "nonexistent")).thenThrow(new MappingNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/nonexistent/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_version_not_found_for_specific_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new PatternVersionNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/api-gateway/versions/9.9.9")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_pattern_not_found_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("missing-pattern")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "missing-pattern")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given().when().get("/calm/namespaces/finos/patterns/missing-pattern/versions/1.0.0")
                .then().statusCode(404).body(containsString("missing-pattern"));
    }

    @Test
    void return_404_when_namespace_not_found_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", ResourceType.PATTERN, "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        given().when().get("/calm/namespaces/badns/patterns/api-gateway/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_500_when_unexpected_error_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("err-version")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "err-version")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new RuntimeException("boom"));

        given().when().get("/calm/namespaces/finos/patterns/err-version/versions/1.0.0")
                .then().statusCode(500);
    }

    @Test
    void verify_store_called_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "api-gateway")).thenReturn(mapping);
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

    // =========================================================================
    // POST /calm — null body, invalid JSON, and permission-denied branches
    // =========================================================================

    @Test
    void return_400_when_post_calm_body_is_blank() {
        given().header("Content-Type", "application/json")
                .body("   ")
                .when().post("/calm")
                .then().statusCode(400).body(containsString("Invalid JSON"));
    }

    @Test
    void return_400_when_post_calm_body_is_invalid_json() {
        given().header("Content-Type", "application/json")
                .body("{invalid-json")
                .when().post("/calm")
                .then().statusCode(400);
    }

    @Test
    void return_400_when_post_calm_has_malformed_domain_control_id() {
        // $id starts with domain prefix but the path structure is invalid
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/bad-format\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm")
                .then().statusCode(400);
    }

    @Test
    void return_403_when_writing_requirement_to_domain_without_permission() {
        when(mockPermissionChecker.canWriteByDomain(any(), eq("security"))).thenReturn(false);
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/my-ctrl/requirement/versions/1.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm")
                .then().statusCode(403).body(containsString("security"));
    }

    @Test
    void return_403_when_writing_configuration_to_domain_without_permission() {
        when(mockPermissionChecker.canWriteByDomain(any(), eq("security"))).thenReturn(false);
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/my-ctrl/configurations/my-cfg/versions/1.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm")
                .then().statusCode(403).body(containsString("security"));
    }

    @Test
    void return_403_when_writing_to_namespace_without_write_permission() {
        when(mockPermissionChecker.canWrite(any(), eq("finos"))).thenReturn(false);
        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "my-pattern", "1.0.0"))
                .when().post("/calm")
                .then().statusCode(403).body(containsString("finos"));
    }

    // =========================================================================
    // POST /calm/namespaces/{ns}/{type}/{name}/versions/{version} edge cases
    // =========================================================================

    @Test
    void return_400_when_versioned_post_has_invalid_resource_type() {
        given().header("Content-Type", "application/json")
                .body("{}")
                .when().post("/calm/namespaces/finos/bananas/my-res/versions/1.0.0")
                .then().statusCode(400).body(containsString("Unsupported resource type"));
    }

    @Test
    void return_400_when_versioned_post_body_is_blank() throws Exception {
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "my-res")).thenThrow(new MappingNotFoundException());
        given().header("Content-Type", "application/json")
                .body("   ")
                .when().post("/calm/namespaces/finos/patterns/my-res/versions/1.0.0")
                .then().statusCode(400);
    }

    @Test
    void return_404_when_namespace_not_found_on_versioned_post_via_namespace_exception() throws Exception {
        when(mockMappingStore.getMapping("badns", ResourceType.PATTERN, "v-test")).thenThrow(new NamespaceNotFoundException());
        given().header("Content-Type", "application/json")
                .body(versionedDoc("badns", "patterns", "v-test", "1.0.0"))
                .when().post("/calm/namespaces/badns/patterns/v-test/versions/1.0.0")
                .then().statusCode(404);
    }

    // =========================================================================
    // GET list versions — additional error cases
    // =========================================================================

    @Test
    void return_400_when_list_versions_has_invalid_resource_type() {
        given().when().get("/calm/namespaces/finos/bananas/my-res/versions")
                .then().statusCode(400).body(containsString("Unsupported resource type"));
    }

    @Test
    void return_404_when_namespace_exception_on_list_versions() throws Exception {
        when(mockMappingStore.getMapping("badns", ResourceType.PATTERN, "api-gateway")).thenThrow(new NamespaceNotFoundException());
        given().when().get("/calm/namespaces/badns/patterns/api-gateway/versions")
                .then().statusCode(404);
    }

    // =========================================================================
    // GET specific version — invalid resource type
    // =========================================================================

    @Test
    void return_400_when_get_version_has_invalid_resource_type() {
        given().when().get("/calm/namespaces/finos/bananas/my-res/versions/1.0.0")
                .then().statusCode(400).body(containsString("Unsupported resource type"));
    }

    // =========================================================================
    // createNewResource — NamespaceNotFoundException from createMapping
    // =========================================================================

    @Test
    void return_404_when_namespace_not_found_in_mapping_store_on_create() throws Exception {
        when(mockMappingStore.getMapping("badns", ResourceType.PATTERN, "new-res")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("badns"), eq("new-res"), eq(ResourceType.PATTERN), eq(0)))
                .thenThrow(new NamespaceNotFoundException());
        given().header("Content-Type", "application/json")
                .body(versionedDoc("badns", "patterns", "new-res", "1.0.0"))
                .when().post("/calm")
                .then().statusCode(404);
    }

    // =========================================================================
    // createDomain — reserved domain name
    // =========================================================================

    @Test
    void return_400_when_creating_domain_with_reserved_name_global() {
        given().header("Content-Type", "application/json")
                .body("{\"name\":\"GLOBAL\"}")
                .when().post("/calm/domains")
                .then().statusCode(400).body(containsString("reserved"));
    }

    // =========================================================================
    // getRequirementVersionsByControlName — error cases
    // =========================================================================

    @Test
    void return_404_when_domain_not_found_on_requirement_versions() throws Exception {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));
        given().when().get("/calm/domains/unknown/controls/access-control/requirement/versions")
                .then().statusCode(404);
    }

    // =========================================================================
    // getRequirementForVersionByControlName — error cases
    // =========================================================================

    @Test
    void return_404_when_domain_not_found_on_requirement_at_version() throws Exception {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));
        given().when().get("/calm/domains/unknown/controls/access-control/requirement/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_control_not_found_on_requirement_at_version() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());
        given().when().get("/calm/domains/security/controls/nonexistent/requirement/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_requirement_version_not_found() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getRequirementForVersion("security", 5, "9.9.9"))
                .thenThrow(new ControlRequirementVersionNotFoundException());
        given().when().get("/calm/domains/security/controls/access-control/requirement/versions/9.9.9")
                .then().statusCode(404);
    }

    // =========================================================================
    // getConfigurationsForControlByName — error cases
    // =========================================================================

    @Test
    void return_404_when_domain_not_found_on_get_configurations() throws Exception {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));
        given().when().get("/calm/domains/unknown/controls/access-control/configurations")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_control_not_found_on_get_configurations() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());
        given().when().get("/calm/domains/security/controls/nonexistent/configurations")
                .then().statusCode(404);
    }

    // =========================================================================
    // getConfigurationVersionsByControlName — error cases
    // =========================================================================

    @Test
    void return_404_when_domain_not_found_on_get_config_versions() throws Exception {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));
        given().when().get("/calm/domains/unknown/controls/access-control/configurations/my-cfg/versions")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_control_not_found_on_get_config_versions() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());
        given().when().get("/calm/domains/security/controls/nonexistent/configurations/my-cfg/versions")
                .then().statusCode(404);
    }

    // =========================================================================
    // getConfigurationForVersionByControlName — error cases
    // =========================================================================

    @Test
    void return_404_when_domain_not_found_on_get_config_at_version() throws Exception {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));
        given().when().get("/calm/domains/unknown/controls/access-control/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_control_not_found_on_get_config_at_version() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());
        given().when().get("/calm/domains/security/controls/nonexistent/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_config_not_found_on_get_config_at_version() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(Collections.emptyList());
        given().when().get("/calm/domains/security/controls/access-control/configurations/nonexistent-cfg/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_config_version_not_found() throws Exception {
        ControlDetail detail = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(detail));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "tls-config")));
        when(mockControlStore.getConfigurationForVersion("security", 5, 10, "9.9.9"))
                .thenThrow(new ControlConfigurationVersionNotFoundException());
        given().when().get("/calm/domains/security/controls/access-control/configurations/tls-config/versions/9.9.9")
                .then().statusCode(404);
    }

    // =========================================================================
    // handleControlRequirementPost — additional error cases (via path endpoint)
    // =========================================================================

    @Test
    void return_400_when_requirement_path_post_body_is_blank() {
        given().header("Content-Type", "application/json")
                .body("   ")
                .when().post("/calm/domains/security/controls/access-control/requirement/versions/1.0.0")
                .then().statusCode(400);
    }

    @Test
    void return_400_when_requirement_path_post_body_is_invalid_json() {
        given().header("Content-Type", "application/json")
                .body("{invalid-json")
                .when().post("/calm/domains/security/controls/access-control/requirement/versions/1.0.0")
                .then().statusCode(400).body(containsString("Cannot parse request body as JSON"));
    }

    @Test
    void return_409_when_requirement_version_already_exists() throws Exception {
        ControlDetail existing = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(existing));
        doThrow(new ControlRequirementVersionExistsException()).when(mockControlStore)
                .createRequirementForVersion(eq("security"), eq(5), eq("2.0.0"), any(CreateControlRequirement.class));
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/requirement/versions/2.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/requirement/versions/2.0.0")
                .then().statusCode(409).body(containsString("already exists"));
    }

    @Test
    void return_404_when_control_not_found_adding_requirement_version() throws Exception {
        ControlDetail existing = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(existing));
        doThrow(new ControlNotFoundException()).when(mockControlStore)
                .createRequirementForVersion(eq("security"), eq(5), eq("2.0.0"), any(CreateControlRequirement.class));
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/requirement/versions/2.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/requirement/versions/2.0.0")
                .then().statusCode(404);
    }

    // =========================================================================
    // handleControlConfigurationPost — additional error cases (via path endpoint)
    // =========================================================================

    @Test
    void return_400_when_config_path_post_body_is_blank() {
        given().header("Content-Type", "application/json")
                .body("   ")
                .when().post("/calm/domains/security/controls/access-control/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(400);
    }

    @Test
    void return_400_when_config_path_post_body_is_invalid_json() {
        given().header("Content-Type", "application/json")
                .body("{invalid-json")
                .when().post("/calm/domains/security/controls/access-control/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(400).body(containsString("Cannot parse request body as JSON"));
    }

    @Test
    void return_400_when_config_path_post_has_no_id() {
        given().header("Content-Type", "application/json")
                .body("{}")
                .when().post("/calm/domains/security/controls/access-control/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(400).body(containsString("$id is required"));
    }

    @Test
    void return_400_when_config_path_post_id_mismatches_path() {
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/other-ctrl/configurations/my-cfg/versions/1.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(400).body(containsString("does not match"));
    }

    @Test
    void return_400_when_config_path_post_first_version_is_not_1_0_0_for_new_config() throws Exception {
        ControlDetail control = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(control));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(Collections.emptyList());
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/configurations/new-cfg/versions/2.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/configurations/new-cfg/versions/2.0.0")
                .then().statusCode(400).body(containsString("first version"));
    }

    @Test
    void return_409_when_config_version_already_exists() throws Exception {
        ControlDetail control = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(control));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "tls-config")));
        doThrow(new ControlConfigurationVersionExistsException()).when(mockControlStore)
                .createConfigurationForVersion(eq("security"), eq(5), eq(10), eq("2.0.0"), any(CreateControlConfiguration.class));
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0")
                .then().statusCode(409).body(containsString("already exists"));
    }

    @Test
    void return_404_when_config_not_found_adding_config_version() throws Exception {
        ControlDetail control = new ControlDetail(5, "access-control", "Desc");
        when(mockControlStore.getControlsForDomain("security")).thenReturn(List.of(control));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "tls-config")));
        doThrow(new ControlConfigurationNotFoundException()).when(mockControlStore)
                .createConfigurationForVersion(eq("security"), eq(5), eq(10), eq("2.0.0"), any(CreateControlConfiguration.class));
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/access-control/configurations/tls-config/versions/2.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_domain_not_found_on_config_path_post() throws Exception {
        when(mockControlStore.getControlsForDomain("unknown")).thenThrow(new DomainNotFoundException("unknown"));
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/unknown/controls/access-control/configurations/my-cfg/versions/1.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/unknown/controls/access-control/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(404);
    }

    @Test
    void return_404_when_control_not_found_on_config_path_post() throws Exception {
        when(mockControlStore.getControlsForDomain("security")).thenReturn(Collections.emptyList());
        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/unknown-ctrl/configurations/my-cfg/versions/1.0.0\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm/domains/security/controls/unknown-ctrl/configurations/my-cfg/versions/1.0.0")
                .then().statusCode(404);
    }

    // --- Snapshot version acceptance on namespace resource endpoints ---

    @Test
    void accept_a_snapshot_version_in_the_path() throws Exception {
        // Only checks the version is not rejected by validation. Mocking an existing mapping
        // and its versions lets the request reach the handler and complete the add-version
        // path, proving the -SNAPSHOT suffix passed the @Pattern check on {version}.
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("snapshot-arch")
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(20).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snapshot-arch")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snapshot-arch", "1.0.0-SNAPSHOT")).when()
                .post("/calm/namespaces/finos/architectures/snapshot-arch/versions/1.0.0-SNAPSHOT")
                .then().statusCode(not(400));
    }

    @Test
    void reject_a_lowercase_snapshot_suffix() {
        given().header("Content-Type", "application/json").body("{}").when()
                .post("/calm/namespaces/finos/architectures/test/versions/1.0.0-snapshot")
                .then().statusCode(400);
    }

    // --- Promotion: publishing a release deletes its snapshot ---

    private static final int PROMOTION_ARCHITECTURE_ID = 60;

    /** Sets up an existing architecture mapping whose only known version is {@code version}. */
    private void givenAnExistingArchitecture(String name, String version) throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId(name)
                .setResourceType(ResourceType.ARCHITECTURE).setNumericId(PROMOTION_ARCHITECTURE_ID).build();
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, name)).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of(version));
    }

    private static String architectureBody(String name, String version) {
        return versionedDoc("finos", "architectures", name, version);
    }

    @Test
    void delete_the_snapshot_when_its_release_version_is_published() throws Exception {
        givenAnExistingArchitecture("test", "1.0.0-SNAPSHOT");

        given()
                .contentType("application/json")
                .body(architectureBody("test", "1.0.0"))
        .when()
                .post("/calm/namespaces/finos/architectures/test/versions/1.0.0")
        .then()
                .statusCode(201);

        verify(mockArchitectureStore).deleteArchitectureVersion("finos", PROMOTION_ARCHITECTURE_ID, "1.0.0-SNAPSHOT");
    }

    @Test
    void publish_a_release_normally_when_there_was_never_a_snapshot() throws Exception {
        // A release POST for a resource with no snapshot must be exactly the operation it was
        // before this feature, so no client needs promotion-specific code.
        givenAnExistingArchitecture("test", "1.0.0");

        given()
                .contentType("application/json")
                .body(architectureBody("test", "1.1.0"))
        .when()
                .post("/calm/namespaces/finos/architectures/test/versions/1.1.0")
        .then()
                .statusCode(201);

        verify(mockArchitectureStore, never()).deleteArchitectureVersion(any(), anyInt(), any());
    }

    @Test
    void still_publish_the_release_when_deleting_the_snapshot_fails() throws Exception {
        // Promotion is not atomic. The release is what the user asked for; a stranded
        // snapshot is recoverable, a lost release is not.
        givenAnExistingArchitecture("test", "1.0.0-SNAPSHOT");
        doThrow(new RuntimeException("mongo down"))
                .when(mockArchitectureStore).deleteArchitectureVersion(any(), anyInt(), any());

        given()
                .contentType("application/json")
                .body(architectureBody("test", "1.0.0"))
        .when()
                .post("/calm/namespaces/finos/architectures/test/versions/1.0.0")
        .then()
                .statusCode(201);
    }

    @Test
    void delete_the_snapshot_when_publishing_a_non_canonical_release_spelling() throws Exception {
        // VERSION_REGEX accepts several spellings of one version ("100" == "1.0.0"). The
        // release spelling must be canonicalised before it's compared against — and used to
        // delete — the canonically stored snapshot, or the snapshot is silently orphaned.
        givenAnExistingArchitecture("test", "1.0.0-SNAPSHOT");

        given()
                .contentType("application/json")
                .body(architectureBody("test", "100"))
        .when()
                .post("/calm/namespaces/finos/architectures/test/versions/100")
        .then()
                .statusCode(201);

        verify(mockArchitectureStore).deleteArchitectureVersion("finos", PROMOTION_ARCHITECTURE_ID, "1.0.0-SNAPSHOT");
    }

    @Test
    void write_the_release_before_deleting_its_snapshot() throws Exception {
        // Promotion is deliberately not atomic, and the order is load-bearing: reversing it
        // would delete the snapshot before knowing the release write succeeds.
        givenAnExistingArchitecture("test", "1.0.0-SNAPSHOT");

        given()
                .contentType("application/json")
                .body(architectureBody("test", "1.0.0"))
        .when()
                .post("/calm/namespaces/finos/architectures/test/versions/1.0.0")
        .then()
                .statusCode(201);

        InOrder order = inOrder(mockArchitectureStore);
        order.verify(mockArchitectureStore).createArchitectureForVersion(any(Architecture.class));
        order.verify(mockArchitectureStore).deleteArchitectureVersion("finos", PROMOTION_ARCHITECTURE_ID, "1.0.0-SNAPSHOT");
    }

    @Test
    void delete_the_snapshot_when_publishing_a_pattern_release() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("promo-pattern")
                .setResourceType(ResourceType.PATTERN).setNumericId(61).build();
        when(mockMappingStore.getMapping("finos", ResourceType.PATTERN, "promo-pattern")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "patterns", "promo-pattern", "1.0.0")).when()
                .post("/calm/namespaces/finos/patterns/promo-pattern/versions/1.0.0")
                .then().statusCode(201);

        verify(mockPatternStore).deletePatternVersion("finos", 61, "1.0.0-SNAPSHOT");
    }

    @Test
    void delete_the_snapshot_when_publishing_a_flow_release() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("promo-flow")
                .setResourceType(ResourceType.FLOW).setNumericId(62).build();
        when(mockMappingStore.getMapping("finos", ResourceType.FLOW, "promo-flow")).thenReturn(existing);
        when(mockFlowStore.getFlowVersions(any(Flow.class))).thenReturn(List.of("1.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "flows", "promo-flow", "1.0.0")).when()
                .post("/calm/namespaces/finos/flows/promo-flow/versions/1.0.0")
                .then().statusCode(201);

        verify(mockFlowStore).deleteFlowVersion("finos", 62, "1.0.0-SNAPSHOT");
    }

    @Test
    void delete_the_snapshot_when_publishing_a_standard_release() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("promo-standard")
                .setResourceType(ResourceType.STANDARD).setNumericId(63).build();
        when(mockMappingStore.getMapping("finos", ResourceType.STANDARD, "promo-standard")).thenReturn(existing);
        when(mockStandardStore.getStandardVersions("finos", 63)).thenReturn(List.of("1.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "standards", "promo-standard", "1.0.0")).when()
                .post("/calm/namespaces/finos/standards/promo-standard/versions/1.0.0")
                .then().statusCode(201);

        verify(mockStandardStore).deleteStandardVersion("finos", 63, "1.0.0-SNAPSHOT");
    }

    @Test
    void delete_the_snapshot_when_publishing_an_interface_release() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("promo-interface")
                .setResourceType(ResourceType.INTERFACE).setNumericId(64).build();
        when(mockMappingStore.getMapping("finos", ResourceType.INTERFACE, "promo-interface")).thenReturn(existing);
        when(mockInterfaceStore.getInterfaceVersions("finos", 64)).thenReturn(List.of("1.0.0-SNAPSHOT"));

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "interfaces", "promo-interface", "1.0.0")).when()
                .post("/calm/namespaces/finos/interfaces/promo-interface/versions/1.0.0")
                .then().statusCode(201);

        verify(mockInterfaceStore).deleteInterfaceVersion("finos", 64, "1.0.0-SNAPSHOT");
    }

    // --- A new resource may start at a snapshot ---

    @Test
    void create_a_brand_new_resource_at_a_snapshot_version() throws Exception {
        // Iterating before the first publish is the main flow the feature exists for. The
        // "first version must be 1.0.0" rule is about the release version.
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "brand-new")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("brand-new"), eq(ResourceType.ARCHITECTURE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("brand-new")
                        .setResourceType(ResourceType.ARCHITECTURE).setNumericId(0).build());
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(70).setVersion("1.0.0-SNAPSHOT").setArchitecture("{}").build();
        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class))).thenReturn(arch);

        given()
                .contentType("application/json")
                .body(architectureBody("brand-new", "1.0.0-SNAPSHOT"))
        .when()
                .post("/calm/namespaces/finos/architectures/brand-new/versions/1.0.0-SNAPSHOT")
        .then()
                .statusCode(201)
                .header("Location", containsString("/versions/1.0.0-SNAPSHOT"));
    }

    @Test
    void refuse_a_brand_new_resource_at_a_later_snapshot_version() throws Exception {
        // The release-version rule still applies: 2.0.0-SNAPSHOT is not a first version.
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "brand-new")).thenThrow(new MappingNotFoundException());

        given()
                .contentType("application/json")
                .body(architectureBody("brand-new", "2.0.0-SNAPSHOT"))
        .when()
                .post("/calm/namespaces/finos/architectures/brand-new/versions/2.0.0-SNAPSHOT")
        .then()
                .statusCode(400)
                .body(containsString("first version of a resource must be 1.0.0"));
    }

    @Test
    void accept_a_non_canonically_spelled_first_snapshot() throws Exception {
        // VERSION_REGEX accepts several spellings of one version ("100" == "1.0.0"), and the
        // guard must canonicalise the release spelling before comparing it against "1.0.0" —
        // releaseVersion alone leaves "100-SNAPSHOT" as "100", which would be wrongly refused.
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "brand-new-2")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("brand-new-2"), eq(ResourceType.ARCHITECTURE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("brand-new-2")
                        .setResourceType(ResourceType.ARCHITECTURE).setNumericId(0).build());
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(71).setVersion("100-SNAPSHOT").setArchitecture("{}").build();
        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class))).thenReturn(arch);

        given()
                .contentType("application/json")
                .body(architectureBody("brand-new-2", "100-SNAPSHOT"))
        .when()
                .post("/calm/namespaces/finos/architectures/brand-new-2/versions/100-SNAPSHOT")
        .then()
                .statusCode(201);
    }

    @Test
    void thread_the_requested_snapshot_version_into_the_architecture_passed_to_the_store() throws Exception {
        // The stores no longer always initialise the first version as 1.0.0 — the requested
        // version must actually reach the store, not a hardcoded literal.
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "brand-new-3")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("brand-new-3"), eq(ResourceType.ARCHITECTURE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("brand-new-3")
                        .setResourceType(ResourceType.ARCHITECTURE).setNumericId(0).build());
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(72).setVersion("1.0.0-SNAPSHOT").setArchitecture("{}").build();
        ArgumentCaptor<Architecture> captor = ArgumentCaptor.forClass(Architecture.class);
        when(mockArchitectureStore.createArchitectureForNamespace(captor.capture())).thenReturn(arch);

        given()
                .contentType("application/json")
                .body(architectureBody("brand-new-3", "1.0.0-SNAPSHOT"))
        .when()
                .post("/calm/namespaces/finos/architectures/brand-new-3/versions/1.0.0-SNAPSHOT")
        .then()
                .statusCode(201);

        assertThat("the requested version must reach the store, not a hardcoded 1.0.0",
                captor.getValue().getDotVersion(), is("1.0.0-SNAPSHOT"));
    }

    // --- Audit: promotion must not clobber the release write's own audit row ---

    /** The most recently recorded {@link AuditLogEntry} passed to {@code AuditService.record}. */
    private AuditLogEntry lastRecordedAuditEntry() {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        verify(mockAuditService, atLeastOnce()).record(captor.capture());
        List<AuditLogEntry> entries = captor.getAllValues();
        return entries.get(entries.size() - 1);
    }

    @Test
    void keep_the_releases_own_audit_row_when_promotion_deletes_a_snapshot() throws Exception {
        // AuditRequestFilter records exactly one row per request. deleteSnapshotForVersion must
        // NOT stage a DELETE for the snapshot it removes, or it would overwrite the release
        // write's own row — leaving no record of the release itself. The release write is the
        // durable event; the snapshot delete is cleanup of the same request.
        givenAnExistingArchitecture("test", "1.0.0-SNAPSHOT");

        given()
            .contentType("application/json")
            .body(architectureBody("test", "1.0.0"))
        .when()
            .post("/calm/namespaces/finos/architectures/test/versions/1.0.0")
        .then()
            .statusCode(201);

        AuditLogEntry entry = lastRecordedAuditEntry();
        assertThat(entry.getAction(), is(not(AuditAction.DELETE)));
        assertThat(entry.getVersion(), is("1.0.0"));
    }

    // --- Snapshot scope: generic POST /calm accepts it for namespace resources, but domain
    // --- controls (out of scope for this feature) must keep rejecting it.

    @Test
    void accept_a_snapshot_id_for_a_namespace_resource_via_generic_post() throws Exception {
        // The $id-driven POST /calm is a separate validation path (CalmDocumentParser#parseCanonicalId)
        // from the path-driven POST .../versions/{version} (which already accepted snapshots).
        // The two must agree on what's a valid version.
        when(mockMappingStore.getMapping("finos", ResourceType.ARCHITECTURE, "snap-generic"))
                .thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("snap-generic"), eq(ResourceType.ARCHITECTURE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("snap-generic")
                        .setResourceType(ResourceType.ARCHITECTURE).setNumericId(80).build());
        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(80).setVersion("1.0.0-SNAPSHOT").setArchitecture("{}").build();
        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class))).thenReturn(arch);

        given().header("Content-Type", "application/json")
                .body(versionedDoc("finos", "architectures", "snap-generic", "1.0.0-SNAPSHOT")).when()
                .post("/calm")
                .then().statusCode(201)
                .header("Location", containsString("/versions/1.0.0-SNAPSHOT"));
    }

    @Test
    void record_a_snapshot_overwrite_via_generic_post_as_an_update_not_a_create() throws Exception {
        // Now that the generic /calm endpoint can reach a snapshot at all (the fix above),
        // this exercises the addNewVersion overwrite branch's AuditRequestFilter.restageAction
        // call through the ONE endpoint that both accepts snapshots AND stages a context
        // (createResourceFromDocument stages CREATE; the specific-version-path endpoint never
        // stages anything at all, so it can't exercise this).
        givenAnExistingArchitecture("test", "2.0.0-SNAPSHOT");

        given()
            .contentType("application/json")
            .body(architectureBody("test", "2.0.0-SNAPSHOT"))
        .when()
            .post("/calm")
        .then()
            .statusCode(200);

        assertThat(lastRecordedAuditEntry().getAction(), is(AuditAction.UPDATE));
    }

    @Test
    void still_reject_a_snapshot_id_for_a_control_requirement_via_generic_post() throws Exception {
        // Domain controls are deliberately out of snapshot scope — validateVersion (a
        // different check from parseCanonicalId's) must keep rejecting -SNAPSHOT here.
        //
        // The control is mocked as already EXISTING so that, if validateVersion's own gate
        // were ever bypassed, the request would fall through to the "add a version to an
        // existing control" success path (201) rather than coincidentally hitting the
        // unrelated "a new control's first version must be 1.0.0" 400 — isolating this test
        // to the version-format check it's meant to pin.
        when(mockControlStore.getControlsForDomain("security"))
                .thenReturn(List.of(new ControlDetail(5, "my-ctrl", "Desc")));

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/my-ctrl/requirement/versions/1.0.0-SNAPSHOT\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm")
                .then().statusCode(400);
    }

    @Test
    void still_reject_a_snapshot_id_for_a_control_configuration_via_generic_post() throws Exception {
        // Same isolation rationale as the requirement test above: mock both the control and
        // the configuration as already existing.
        when(mockControlStore.getControlsForDomain("security"))
                .thenReturn(List.of(new ControlDetail(5, "my-ctrl", "Desc")));
        when(mockControlStore.getConfigurationDetailsForControl("security", 5))
                .thenReturn(List.of(new ControlConfigDetail(10, "my-cfg")));

        String body = "{\"$id\":\"http://localhost:8080/calm/domains/security/controls/my-ctrl/configurations/my-cfg/versions/1.0.0-SNAPSHOT\"}";
        given().header("Content-Type", "application/json")
                .body(body)
                .when().post("/calm")
                .then().statusCode(400);
    }
}
