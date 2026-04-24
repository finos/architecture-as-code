package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.*;
import org.finos.calm.domain.exception.*;
import org.finos.calm.domain.interfaces.CreateInterfaceRequest;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.domain.standards.CreateStandardRequest;
import org.finos.calm.store.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestFrontControllerResourceShould {

    @InjectMock
    ResourceMappingStore mockMappingStore;

    @InjectMock
    PatternStore mockPatternStore;

    @InjectMock
    ArchitectureStore mockArchitectureStore;

    @InjectMock
    StandardStore mockStandardStore;

    @InjectMock
    InterfaceStore mockInterfaceStore;

    // --- POST create new resource ---

    @Test
    void return_201_when_creating_a_new_pattern_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(0).build());

        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"))).thenReturn(pattern);

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{ \\\"test\\\": \\\"value\\\" }\", \"name\": \"API Gateway\", \"description\": \"Gateway pattern\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/api-gateway/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "api-gateway", 1);
    }

    @Test
    void return_400_when_type_is_missing_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "no-type")).thenThrow(new MappingNotFoundException());

        String body = "{ \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/no-type")
                .then()
                .statusCode(400)
                .body(containsString("type"));
    }

    @Test
    void return_400_when_type_is_invalid_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "bad-type")).thenThrow(new MappingNotFoundException());

        String body = "{ \"type\": \"UNKNOWN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/bad-type")
                .then()
                .statusCode(400)
                .body(containsString("Invalid resource type"));
    }

    @Test
    void return_404_when_namespace_not_found_on_create() throws Exception {
        when(mockMappingStore.getMapping("invalid", "test-resource")).thenThrow(new NamespaceNotFoundException());

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/invalid/test-resource")
                .then()
                .statusCode(404);
    }

    @Test
    void return_400_when_custom_id_format_is_invalid() {
        given()
                .header("Content-Type", "application/json")
                .body("{ \"type\": \"PATTERN\", \"json\": \"{}\" }")
                .when()
                .post("/calm/namespaces/finos/INVALID_ID")
                .then()
                .statusCode(400);
    }

    // --- POST update existing resource ---

    @Test
    void return_201_when_updating_an_existing_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);

        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));

        String body = "{ \"json\": \"{}\", \"changeType\": \"MINOR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/api-gateway/versions/1.1.0"));
    }

    @Test
    void return_400_when_change_type_is_missing_on_update() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);

        String body = "{ \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(400)
                .body(containsString("changeType"));
    }

    @Test
    void return_400_when_change_type_is_invalid_on_update() throws Exception {
        String body = "{ \"json\": \"{}\", \"changeType\": \"INVALID\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(400)
                .body(containsString("Cannot parse request body"));
    }

    // --- GET latest resource ---

    @Test
    void return_200_with_latest_version_on_get() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0", "1.1.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{ \"test\": \"data\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("test"));
    }

    @Test
    void return_404_when_mapping_not_found_on_get() throws Exception {
        when(mockMappingStore.getMapping("finos", "nonexistent")).thenThrow(new MappingNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/nonexistent")
                .then()
                .statusCode(404)
                .body(containsString("nonexistent"));
    }

    @Test
    void return_404_when_namespace_not_found_on_get() throws Exception {
        when(mockMappingStore.getMapping("invalid", "test")).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/test")
                .then()
                .statusCode(404);
    }

    // --- GET specific version ---

    @Test
    void return_200_for_specific_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{ \"version\": \"1.0.0\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("1.0.0"));
    }

    @Test
    void return_404_when_mapping_not_found_on_get_version() throws Exception {
        when(mockMappingStore.getMapping("finos", "nonexistent")).thenThrow(new MappingNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/nonexistent/versions/1.0.0")
                .then()
                .statusCode(404);
    }

    // --- GET list versions ---

    @Test
    void return_200_with_version_list() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0", "1.1.0"));

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2))
                .body("values[0]", is("1.0.0"))
                .body("values[1]", is("1.1.0"));
    }

    @Test
    void return_404_when_mapping_not_found_on_list_versions() throws Exception {
        when(mockMappingStore.getMapping("finos", "nonexistent")).thenThrow(new MappingNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/nonexistent/versions")
                .then()
                .statusCode(404);
    }

    // --- GET mappings lookup ---

    @Test
    void return_200_with_all_mappings_for_namespace() throws Exception {
        ResourceMapping m1 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        ResourceMapping m2 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("main-arch").setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();

        when(mockMappingStore.listMappings(eq("finos"), isNull())).thenReturn(List.of(m1, m2));

        given()
                .when()
                .get("/calm/namespaces/finos/mappings")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    void return_200_with_mappings_filtered_by_type() throws Exception {
        ResourceMapping m1 = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();

        when(mockMappingStore.listMappings("finos", ResourceType.PATTERN)).thenReturn(List.of(m1));

        given()
                .when()
                .get("/calm/namespaces/finos/mappings?type=PATTERN")
                .then()
                .statusCode(200)
                .body("values", hasSize(1));
    }

    @Test
    void return_200_with_mapping_for_numeric_id_lookup() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();

        when(mockMappingStore.getMappingByNumericId("finos", ResourceType.PATTERN, 1)).thenReturn(mapping);

        given()
                .when()
                .get("/calm/namespaces/finos/mappings?type=PATTERN&id=1")
                .then()
                .statusCode(200)
                .body("values", hasSize(1))
                .body("values[0].customId", is("api-gateway"));
    }

    @Test
    void return_200_with_empty_list_when_numeric_id_not_mapped() throws Exception {
        when(mockMappingStore.getMappingByNumericId("finos", ResourceType.PATTERN, 999))
                .thenThrow(new MappingNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/mappings?type=PATTERN&id=999")
                .then()
                .statusCode(200)
                .body("values", hasSize(0));
    }

    @Test
    void return_404_when_namespace_not_found_on_mappings() throws Exception {
        when(mockMappingStore.listMappings(eq("invalid"), isNull())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid/mappings")
                .then()
                .statusCode(404);
    }

    // --- Metadata preservation ---

    @Test
    void pass_name_and_description_through_to_pattern_store_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "named-pattern")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("named-pattern"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("named-pattern").setResourceType(ResourceType.PATTERN).setNumericId(0).build());

        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(10).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"))).thenReturn(pattern);

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\", \"name\": \"My Pattern\", \"description\": \"A test pattern\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/named-pattern")
                .then()
                .statusCode(201);

        var captor = org.mockito.ArgumentCaptor.forClass(CreatePatternRequest.class);
        verify(mockPatternStore).createPatternForNamespace(captor.capture(), eq("finos"));
        var req = captor.getValue();
        assertThat(req.getName(), is("My Pattern"));
        assertThat(req.getDescription(), is("A test pattern"));
    }

    @Test
    void default_name_and_description_to_empty_when_not_provided() throws Exception {
        when(mockMappingStore.getMapping("finos", "no-meta")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("no-meta"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("no-meta").setResourceType(ResourceType.PATTERN).setNumericId(0).build());

        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(11).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos"))).thenReturn(pattern);

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/no-meta")
                .then()
                .statusCode(201);

        var captor = org.mockito.ArgumentCaptor.forClass(CreatePatternRequest.class);
        verify(mockPatternStore).createPatternForNamespace(captor.capture(), eq("finos"));
        var req = captor.getValue();
        assertThat(req.getName(), is(""));
        assertThat(req.getDescription(), is(""));
    }

    // --- Sorted version list ---

    @Test
    void return_versions_sorted_by_semver() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("sorted-test").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "sorted-test")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("2.0.0", "1.0.0", "1.1.0", "1.0.1"));

        given()
                .when()
                .get("/calm/namespaces/finos/sorted-test/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(4))
                .body("values[0]", is("1.0.0"))
                .body("values[1]", is("1.0.1"))
                .body("values[2]", is("1.1.0"))
                .body("values[3]", is("2.0.0"));
    }

    // --- Rollback on create failure ---

    @Test
    void rollback_mapping_when_store_creation_fails() throws Exception {
        when(mockMappingStore.getMapping("finos", "fail-create")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("fail-create"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("fail-create").setResourceType(ResourceType.PATTERN).setNumericId(0).build());

        when(mockPatternStore.createPatternForNamespace(any(CreatePatternRequest.class), eq("finos")))
                .thenThrow(new RuntimeException("Store failure"));

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/fail-create")
                .then()
                .statusCode(400);

        verify(mockMappingStore).deleteMapping("finos", "fail-create");
    }

    @Test
    void return_409_when_duplicate_custom_id_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "dup-id")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("dup-id"), eq(ResourceType.PATTERN), eq(0)))
                .thenThrow(new DuplicateMappingException());

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/dup-id")
                .then()
                .statusCode(409)
                .body(containsString("already exists"));
    }

    // --- Additional resource type coverage ---

    @Test
    void return_201_when_creating_a_new_architecture_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-arch")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("my-arch"), eq(ResourceType.ARCHITECTURE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-arch").setResourceType(ResourceType.ARCHITECTURE).setNumericId(0).build());

        Architecture arch = new Architecture.ArchitectureBuilder()
                .setNamespace("finos").setId(2).setVersion("1.0.0").setArchitecture("{}").build();
        when(mockArchitectureStore.createArchitectureForNamespace(any(Architecture.class))).thenReturn(arch);

        String body = "{ \"type\": \"ARCHITECTURE\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/my-arch")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/my-arch/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-arch", 2);
    }

    @Test
    void return_201_when_creating_a_new_standard_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-standard")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("my-standard"), eq(ResourceType.STANDARD), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-standard").setResourceType(ResourceType.STANDARD).setNumericId(0).build());

        Standard standard = new Standard("", "", "{}", 3, "1.0.0");
        standard.setNamespace("finos");
        when(mockStandardStore.createStandardForNamespace(any(CreateStandardRequest.class), eq("finos"))).thenReturn(standard);

        String body = "{ \"type\": \"STANDARD\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/my-standard")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/my-standard/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-standard", 3);
    }

    @Test
    void return_201_when_creating_a_new_interface_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "my-interface")).thenThrow(new MappingNotFoundException());

        when(mockMappingStore.createMapping(eq("finos"), eq("my-interface"), eq(ResourceType.INTERFACE), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("my-interface").setResourceType(ResourceType.INTERFACE).setNumericId(0).build());

        CalmInterface iface = new CalmInterface("", "", "{}", 4, "1.0.0");
        iface.setNamespace("finos");
        when(mockInterfaceStore.createInterfaceForNamespace(any(CreateInterfaceRequest.class), eq("finos"))).thenReturn(iface);

        String body = "{ \"type\": \"INTERFACE\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/my-interface")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/my-interface/versions/1.0.0"));

        verify(mockMappingStore).updateMappingNumericId("finos", "my-interface", 4);
    }

    // --- Verify store interactions on GET ---

    @Test
    void verify_store_called_on_get_latest() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{}");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(200);

        verify(mockPatternStore).getPatternVersions(any(Pattern.class));
        verify(mockPatternStore).getPatternForVersion(any(Pattern.class));
    }

    @Test
    void verify_store_called_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("{}");

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway/versions/1.0.0")
                .then()
                .statusCode(200);

        verify(mockPatternStore).getPatternForVersion(any(Pattern.class));
    }

    @Test
    void verify_store_called_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway/versions")
                .then()
                .statusCode(200);

        verify(mockPatternStore).getPatternVersions(any(Pattern.class));
    }

    // --- id without type validation ---

    @Test
    void return_400_when_id_provided_without_type() throws Exception {
        given()
                .when()
                .get("/calm/namespaces/finos/mappings?id=1")
                .then()
                .statusCode(400)
                .body(containsString("type"));
    }

    // --- Update for non-PATTERN resource types (covers createVersionedResourceInStore switch branches) ---

    @Test
    void return_201_when_updating_an_existing_architecture_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch").setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(existing);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));

        String body = "{ \"json\": \"{}\", \"changeType\": \"MINOR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/my-arch")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/my-arch/versions/1.1.0"));

        verify(mockArchitectureStore).createArchitectureForVersion(any(Architecture.class));
    }

    @Test
    void return_201_when_updating_an_existing_standard_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard").setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(existing);
        when(mockStandardStore.getStandardVersions("finos", 3)).thenReturn(List.of("1.0.0"));

        String body = "{ \"json\": \"{}\", \"changeType\": \"PATCH\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/my-standard")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/my-standard/versions/1.0.1"));

        verify(mockStandardStore).createStandardForVersion(any(CreateStandardRequest.class), eq("finos"), eq(3), eq("1.0.1"));
    }

    @Test
    void return_201_when_updating_an_existing_interface_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface").setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(existing);
        when(mockInterfaceStore.getInterfaceVersions("finos", 4)).thenReturn(List.of("1.0.0"));

        String body = "{ \"json\": \"{}\", \"changeType\": \"MINOR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/my-interface")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/my-interface/versions/1.1.0"));

        verify(mockInterfaceStore).createInterfaceForVersion(any(CreateInterfaceRequest.class), eq("finos"), eq(4), eq("1.1.0"));
    }

    // --- GET latest for non-PATTERN types (covers getVersionsForMapping + getResourceJsonForVersion switch branches) ---

    @Test
    void return_200_with_latest_architecture_version_on_get() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch").setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(mapping);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0"));
        when(mockArchitectureStore.getArchitectureForVersion(any(Architecture.class))).thenReturn("{ \"arch\": true }");

        given()
                .when()
                .get("/calm/namespaces/finos/my-arch")
                .then()
                .statusCode(200)
                .body(containsString("arch"));
    }

    @Test
    void return_200_with_latest_standard_version_on_get() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard").setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(mapping);
        when(mockStandardStore.getStandardVersions("finos", 3)).thenReturn(List.of("1.0.0"));
        when(mockStandardStore.getStandardForVersion("finos", 3, "1.0.0")).thenReturn("{ \"standard\": true }");

        given()
                .when()
                .get("/calm/namespaces/finos/my-standard")
                .then()
                .statusCode(200)
                .body(containsString("standard"));
    }

    @Test
    void return_200_with_latest_interface_version_on_get() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface").setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(mapping);
        when(mockInterfaceStore.getInterfaceVersions("finos", 4)).thenReturn(List.of("1.0.0"));
        when(mockInterfaceStore.getInterfaceForVersion("finos", 4, "1.0.0")).thenReturn("{ \"iface\": true }");

        given()
                .when()
                .get("/calm/namespaces/finos/my-interface")
                .then()
                .statusCode(200)
                .body(containsString("iface"));
    }

    // --- GET specific version for non-PATTERN types ---

    @Test
    void return_200_for_specific_architecture_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch").setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(mapping);
        when(mockArchitectureStore.getArchitectureForVersion(any(Architecture.class))).thenReturn("{ \"v\": \"1.0.0\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/my-arch/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_standard_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard").setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(mapping);
        when(mockStandardStore.getStandardForVersion("finos", 3, "1.0.0")).thenReturn("{ \"v\": \"1.0.0\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/my-standard/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("1.0.0"));
    }

    @Test
    void return_200_for_specific_interface_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface").setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(mapping);
        when(mockInterfaceStore.getInterfaceForVersion("finos", 4, "1.0.0")).thenReturn("{ \"v\": \"1.0.0\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/my-interface/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("1.0.0"));
    }

    // --- List versions for non-PATTERN types ---

    @Test
    void return_200_with_architecture_version_list() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-arch").setResourceType(ResourceType.ARCHITECTURE).setNumericId(2).build();
        when(mockMappingStore.getMapping("finos", "my-arch")).thenReturn(mapping);
        when(mockArchitectureStore.getArchitectureVersions(any(Architecture.class))).thenReturn(List.of("1.0.0", "1.1.0"));

        given()
                .when()
                .get("/calm/namespaces/finos/my-arch/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(2));
    }

    @Test
    void return_200_with_standard_version_list() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-standard").setResourceType(ResourceType.STANDARD).setNumericId(3).build();
        when(mockMappingStore.getMapping("finos", "my-standard")).thenReturn(mapping);
        when(mockStandardStore.getStandardVersions("finos", 3)).thenReturn(List.of("1.0.0"));

        given()
                .when()
                .get("/calm/namespaces/finos/my-standard/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1));
    }

    @Test
    void return_200_with_interface_version_list() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("my-interface").setResourceType(ResourceType.INTERFACE).setNumericId(4).build();
        when(mockMappingStore.getMapping("finos", "my-interface")).thenReturn(mapping);
        when(mockInterfaceStore.getInterfaceVersions("finos", 4)).thenReturn(List.of("1.0.0"));

        given()
                .when()
                .get("/calm/namespaces/finos/my-interface/versions")
                .then()
                .statusCode(200)
                .body("values", hasSize(1));
    }

    // --- Exception coverage: version-not-found, resource-not-found, malformed JSON ---

    @Test
    void return_404_when_version_not_found_for_specific_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new PatternVersionNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway/versions/9.9.9")
                .then()
                .statusCode(404);
    }

    @Test
    void return_404_when_pattern_not_found_on_get_latest() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(404);
    }

    @Test
    void return_400_when_create_body_is_malformed_json() throws Exception {
        when(mockMappingStore.getMapping("finos", "bad-json")).thenThrow(new MappingNotFoundException());

        given()
                .header("Content-Type", "application/json")
                .body("not valid json {{{")
                .when()
                .post("/calm/namespaces/finos/bad-json")
                .then()
                .statusCode(400);
    }

    @Test
    void return_400_when_update_body_is_malformed_json() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);

        given()
                .header("Content-Type", "application/json")
                .body("not valid json {{{")
                .when()
                .post("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(400);
    }

    @Test
    void return_400_when_json_field_is_missing_on_update() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);

        String body = "{ \"changeType\": \"MINOR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/api-gateway")
                .then()
                .statusCode(400)
                .body(containsString("json"));
    }

    @Test
    void return_400_when_json_field_is_missing_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "no-json")).thenThrow(new MappingNotFoundException());

        String body = "{ \"type\": \"PATTERN\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/no-json")
                .then()
                .statusCode(400)
                .body(containsString("json"));
    }

    // --- NamespaceNotFoundException tests for GET endpoints ---

    @Test
    void return_400_when_namespace_not_found_on_get_latest() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/badns/api-gateway")
                .then()
                .statusCode(404);
    }

    @Test
    void return_404_when_namespace_not_found_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/badns/api-gateway/versions/1.0.0")
                .then()
                .statusCode(404);
    }

    @Test
    void return_404_when_namespace_not_found_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/badns/api-gateway/versions")
                .then()
                .statusCode(404);
    }

    // --- DuplicateMappingException on create ---

    @Test
    void return_409_when_duplicate_mapping_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "dup-id")).thenThrow(new MappingNotFoundException());
        doThrow(new DuplicateMappingException()).when(mockMappingStore).createMapping("finos", "dup-id", ResourceType.PATTERN, 0);

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/dup-id")
                .then()
                .statusCode(409);
    }

    // --- NamespaceNotFoundException on create when mapping reserved ---

    @Test
    void return_404_when_namespace_not_found_during_mapping_reservation() throws Exception {
        when(mockMappingStore.getMapping("badns", "new-res")).thenThrow(new MappingNotFoundException());
        doThrow(new NamespaceNotFoundException()).when(mockMappingStore).createMapping("badns", "new-res", ResourceType.PATTERN, 0);

        String body = "{ \"type\": \"PATTERN\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/badns/new-res")
                .then()
                .statusCode(404);
    }

    // --- IllegalArgumentException on update (bad changeType) via NamespaceNotFoundException ---

    @Test
    void return_404_when_namespace_not_found_on_update() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("badns").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("badns", "api-gateway")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new NamespaceNotFoundException());

        String body = "{ \"json\": \"{}\", \"changeType\": \"MINOR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/badns/api-gateway")
                .then()
                .statusCode(404);
    }

    // --- Invalid resource type on lookupMappings (parseResourceType coverage) ---

    @Test
    void return_200_when_lookup_mappings_with_invalid_type() throws Exception {
        when(mockMappingStore.listMappings(eq("finos"), any())).thenReturn(List.of());

        given()
                .when()
                .get("/calm/namespaces/finos/mappings?type=INVALID_TYPE")
                .then()
                .statusCode(200);
    }

    // --- Empty versions list on GET latest ---

    @Test
    void return_404_when_versions_list_is_empty_on_get_latest() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("empty-ver").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "empty-ver")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of());

        given()
                .when()
                .get("/calm/namespaces/finos/empty-ver")
                .then()
                .statusCode(404);
    }

    // --- Invalid type string on create ---

    @Test
    void return_400_when_resource_type_is_invalid_on_create() throws Exception {
        when(mockMappingStore.getMapping("finos", "bad-type")).thenThrow(new MappingNotFoundException());

        String body = "{ \"type\": \"BANANAS\", \"json\": \"{}\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/bad-type")
                .then()
                .statusCode(400)
                .body(containsString("Invalid resource type"));
    }

    // --- Error handling edge cases ---

    @Test
    void return_500_when_unexpected_exception_on_get_latest() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("err-resource").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "err-resource")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new RuntimeException("unexpected"));

        given()
                .when()
                .get("/calm/namespaces/finos/err-resource")
                .then()
                .statusCode(500);
    }

    @Test
    void return_404_when_pattern_not_found_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("missing-pattern").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "missing-pattern")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/missing-pattern/versions/1.0.0")
                .then()
                .statusCode(404)
                .body(containsString("missing-pattern"));
    }

    @Test
    void return_404_when_pattern_not_found_on_list_versions() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("missing-versions").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "missing-versions")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenThrow(new PatternNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/finos/missing-versions/versions")
                .then()
                .statusCode(404)
                .body(containsString("missing-versions"));
    }

    @Test
    void return_404_on_update_when_existing_mapping_has_no_versions() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("orphan").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "orphan")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of());

        String body = "{ \"json\": \"{}\", \"changeType\": \"MINOR\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/orphan")
                .then()
                .statusCode(404)
                .body(containsString("orphan"));
    }
}
