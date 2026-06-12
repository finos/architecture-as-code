package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.Pattern;
import org.finos.calm.domain.ResourceMapping;
import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.MappingNotFoundException;
import org.finos.calm.domain.pattern.CreatePatternRequest;
import org.finos.calm.store.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@TestProfile(BaseUrlConfiguredProfile.class)
public class TestMappingControllerResourceWithBaseUrlShould {

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

    @InjectMock
    FlowStore mockFlowStore;

    /** GET latest rewrites $id to the versionless canonical URL. */
    @Test
    void rewrite_id_with_versionless_url_on_get_latest() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class)))
                .thenReturn("{ \"$id\": \"old-id\", \"name\": \"original\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/patterns/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("https://hub.example.com/calm/namespaces/finos/patterns/api-gateway"))
                .body(containsString("original"));
    }

    /** GET specific version rewrites $id to the versioned canonical URL. */
    @Test
    void rewrite_id_with_versioned_url_on_get_version() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternForVersion(any(Pattern.class)))
                .thenReturn("{ \"$id\": \"old-id\", \"name\": \"original\" }");

        given()
                .when()
                .get("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0")
                .then()
                .statusCode(200)
                .body(containsString("https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0"));
    }

    /** POST to /calm with a versioned $id of 1.0.0 matching the canonical URL creates the resource. */
    @Test
    void return_201_when_post_to_calm_with_versioned_id_matching_canonical_url() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(), eq("finos"))).thenReturn(pattern);

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm")
                .then()
                .statusCode(201)
                .header("Location", containsString("/versions/1.0.0"));
    }

    /** POST to /calm with a versionless $id is rejected with 400 (version is required). */
    @Test
    void return_400_when_post_body_id_has_no_version() throws Exception {
        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm")
                .then()
                .statusCode(400)
                .body(containsString("must include a version"));
    }

    /** POST to /calm with missing $id is rejected with 400 when base-url is configured. */
    @Test
    void return_400_when_post_with_missing_id() throws Exception {
        given()
                .header("Content-Type", "application/json")
                .body("{ \"name\": \"no id here\" }")
                .when()
                .post("/calm")
                .then()
                .statusCode(400)
                .body(containsString("$id"));
    }

    @Test
    void leave_non_object_json_unchanged_when_base_url_configured() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("[1, 2, 3]");

        given()
                .when()
                .get("/calm/namespaces/finos/patterns/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("[1, 2, 3]"));
    }

    @Test
    void leave_invalid_json_unchanged_when_base_url_configured() throws Exception {
        ResourceMapping mapping = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway").setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(mapping);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));
        when(mockPatternStore.getPatternForVersion(any(Pattern.class))).thenReturn("not-json");

        given()
                .when()
                .get("/calm/namespaces/finos/patterns/api-gateway")
                .then()
                .statusCode(200)
                .body(containsString("not-json"));
    }

    /**
     * POST to /calm with a versioned $id of 2.0.0 on a brand-new resource is rejected with 400
     * because the first version must be 1.0.0.
     */
    @Test
    void return_400_when_post_with_versioned_id_above_1_0_0_on_new_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm")
                .then()
                .statusCode(400)
                .body(containsString("first version of a resource must be 1.0.0"));
    }

    /**
     * POST to /calm with a versioned $id of 1.0.0 on a brand-new resource is accepted.
     */
    @Test
    void return_201_when_post_with_versioned_id_of_1_0_0_on_new_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(), eq("finos"))).thenReturn(pattern);

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm")
                .then()
                .statusCode(201)
                .header("Location", containsString("/versions/1.0.0"));
    }

    // --- POST specific version endpoint ---

    /** Specific-version endpoint creates 1.0.0 on a brand-new resource. */
    @Test
    void return_201_when_specific_version_endpoint_creates_1_0_0_on_new_resource() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        when(mockPatternStore.createPatternForNamespace(any(), eq("finos"))).thenReturn(pattern);

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/versions/1.0.0"));
    }

    /** Specific-version endpoint rejects a first version other than 1.0.0. */
    @Test
    void return_400_when_specific_version_endpoint_seeds_above_1_0_0() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0")
                .then()
                .statusCode(400)
                .body(containsString("first version of a resource must be 1.0.0"));
    }

    /** Specific-version endpoint adds the requested version to an existing resource. */
    @Test
    void return_201_when_specific_version_endpoint_adds_version_to_existing_resource() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0"));

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0")
                .then()
                .statusCode(201)
                .header("Location", containsString("/versions/2.0.0"));

        verify(mockPatternStore).createPatternForVersion(any(Pattern.class));
    }

    /** Specific-version endpoint returns 409 when the requested version already exists. */
    @Test
    void return_409_when_specific_version_endpoint_version_exists() throws Exception {
        ResourceMapping existing = new ResourceMapping.ResourceMappingBuilder()
                .setNamespace("finos").setCustomId("api-gateway")
                .setResourceType(ResourceType.PATTERN).setNumericId(1).build();
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenReturn(existing);
        when(mockPatternStore.getPatternVersions(any(Pattern.class))).thenReturn(List.of("1.0.0", "2.0.0"));

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0")
                .then()
                .statusCode(409)
                .body(containsString("already exists"));
    }

    /** Specific-version endpoint rejects a $id whose version differs from the path version. */
    @Test
    void return_400_when_specific_version_endpoint_id_version_mismatches_path() throws Exception {
        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/3.0.0\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm/namespaces/finos/patterns/api-gateway/versions/2.0.0")
                .then()
                .statusCode(400)
                .body(containsString("does not match"));
    }

    /** Specific-version endpoint requires a $id. */
    @Test
    void return_400_when_specific_version_endpoint_has_no_id() throws Exception {
        given()
                .header("Content-Type", "application/json")
                .body("{ \"name\": \"no id\" }")
                .when()
                .post("/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0")
                .then()
                .statusCode(400)
                .body(containsString("$id"));
    }

    /**
     * POST to /calm strips the top-level $id before persistence while preserving the rest of the document.
     */
    @Test
    void post_strips_id_but_preserves_document_content() throws Exception {
        when(mockMappingStore.getMapping("finos", "api-gateway")).thenThrow(new MappingNotFoundException());
        when(mockMappingStore.createMapping(eq("finos"), eq("api-gateway"), eq(ResourceType.PATTERN), eq(0)))
                .thenReturn(new ResourceMapping.ResourceMappingBuilder()
                        .setNamespace("finos").setCustomId("api-gateway")
                        .setResourceType(ResourceType.PATTERN).setNumericId(0).build());
        Pattern pattern = new Pattern.PatternBuilder()
                .setNamespace("finos").setId(1).setVersion("1.0.0").setPattern("{}").build();
        ArgumentCaptor<CreatePatternRequest> captor = ArgumentCaptor.forClass(CreatePatternRequest.class);
        when(mockPatternStore.createPatternForNamespace(captor.capture(), eq("finos"))).thenReturn(pattern);

        String body = "{ \"$id\": \"https://hub.example.com/calm/namespaces/finos/patterns/api-gateway/versions/1.0.0\", \"name\": \"my-pattern\" }";

        given()
                .header("Content-Type", "application/json")
                .body(body)
                .when()
                .post("/calm")
                .then()
                .statusCode(201);

        verify(mockPatternStore).createPatternForNamespace(any(), eq("finos"));
        assertThat("store does not receive the $id field",
                captor.getValue().getPatternJson(), not(containsString("$id")));
        assertThat("store receives the full document content",
                captor.getValue().getPatternJson(), containsString("my-pattern"));
    }
}
