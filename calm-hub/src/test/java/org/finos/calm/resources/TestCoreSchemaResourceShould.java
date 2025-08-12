package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.CoreSchemaStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.mockito.Mockito.any;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestCoreSchemaResourceShould {

    public static final String TEST_CORE_SCHEMA = "{\"test\":\"test\"}";

    @InjectMock
    CoreSchemaStore mockCoreSchemaStore;

    @Test
    void return_no_versions_when_store_empty() {
        // Given: Mock the getVersions() method to return a list of version strings
        List<String> mockVersions = new ArrayList<>();
        when(mockCoreSchemaStore.getVersions()).thenReturn(mockVersions);

        // When: Perform a GET request to /calm/schemas
        given()
                .when()
                .get("/calm/schemas")
                .then()
                // Then: Verify the status code is 200 OK and the body contains the expected JSON
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        // Verify that the getVersions method was called exactly once
        verify(mockCoreSchemaStore, times(1)).getVersions();
    }

    @Test
    void return_valid_schema_versions_wrapped_in_an_object() {
        // Given: Mock the getVersions() method to return a list of version strings
        List<String> mockVersions = Arrays.asList("v1.0", "v2.0", "v3.0");
        when(mockCoreSchemaStore.getVersions()).thenReturn(mockVersions);

        // When: Perform a GET request to /calm/schemas
        given()
                .when()
                .get("/calm/schemas")
                .then()
                // Then: Verify the status code is 200 OK and the body contains the expected JSON
                .statusCode(200)
                .body(equalTo("{\"values\":[\"v1.0\",\"v2.0\",\"v3.0\"]}"));

        // Verify that the getVersions method was called exactly once
        verify(mockCoreSchemaStore, times(1)).getVersions();
    }

    @Test
    void return_a_404_when_an_invalid_version_is_provided() {
        when(mockCoreSchemaStore.getSchemasForVersion(anyString())).thenReturn(null);

        given()
                .when()
                .get("/calm/schemas/2021-01/meta")
                .then()
                .statusCode(404);

        verify(mockCoreSchemaStore, times(1)).getSchemasForVersion("2021-01");
    }

    @Test
    void return_a_list_of_schemas_for_a_valid_version() {
        setupMockSchemasForVersion();

        given()
                .when()
                .get("/calm/schemas/2024-09/meta")
                .then()
                .statusCode(200)
                .body("values", containsInAnyOrder("calm.json", "core.json"));

        verify(mockCoreSchemaStore, times(1)).getSchemasForVersion("2024-09");
    }

    @Test
    void return_a_404_when_an_invalid_version_is_provided_on_schema_retrieval() {
        when(mockCoreSchemaStore.getSchemasForVersion(anyString())).thenReturn(null);

        given()
                .when()
                .get("/calm/schemas/2021-01/meta/calm.json")
                .then()
                .statusCode(404);

        verify(mockCoreSchemaStore, times(1)).getSchemasForVersion("2021-01");
    }

    @Test
    void return_a_404_when_an_invalid_schema_is_requested_for_a_given_version() {
        setupMockSchemasForVersion();

        given()
                .when()
                .get("/calm/schemas/2021-01/meta/invalid.json")
                .then()
                .statusCode(404);

        verify(mockCoreSchemaStore, times(1)).getSchemasForVersion("2021-01");
    }

    @Test
    void return_a_schema_for_valid_version_and_schema_name() {
        setupMockSchemasForVersion();

        given()
                .when()
                .get("/calm/schemas/2021-01/meta/core.json")
                .then()
                .statusCode(200)
                .body(equalTo(TEST_CORE_SCHEMA));

        verify(mockCoreSchemaStore, times(1)).getSchemasForVersion("2021-01");
    }

    @Test
    void create_schema_version_successfully() {
        when(mockCoreSchemaStore.getSchemasForVersion("2024-10")).thenReturn(null);
        given()
                .contentType("application/json")
                .body("{\"version\":\"2024-10\",\"schemas\":{\"calm.json\":{},\"core.json\":{}}}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/schemas/2024-10/meta"));
        verify(mockCoreSchemaStore).getSchemasForVersion("2024-10");
        verify(mockCoreSchemaStore).createSchemaVersion(eq("2024-10"), ArgumentMatchers.any());
    }

    @Test
    void return_400_when_version_is_null() {
        given()
                .contentType("application/json")
                .body("{\"schemas\":{\"calm.json\":{}}}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(400)
                .body(containsString("Version is required"));

        verify(mockCoreSchemaStore, never()).getSchemasForVersion(any());
        verify(mockCoreSchemaStore, never()).createSchemaVersion(any(), any());
    }

    @Test
    void return_400_when_version_is_empty() {
        given()
                .contentType("application/json")
                .body("{\"version\":\"\",\"schemas\":{\"calm.json\":{}}}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(400)
                .body(containsString("Version is required"));

        verify(mockCoreSchemaStore, never()).getSchemasForVersion(any());
        verify(mockCoreSchemaStore, never()).createSchemaVersion(any(), any());
    }

    @Test
    void return_400_when_schemas_are_null() {
        given()
                .contentType("application/json")
                .body("{\"version\":\"2024-10\"}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(400)
                .body(containsString("Schemas are required"));

        verify(mockCoreSchemaStore, never()).getSchemasForVersion(any());
        verify(mockCoreSchemaStore, never()).createSchemaVersion(any(), any());
    }

    @Test
    void return_400_when_schemas_are_empty() {
        given()
                .contentType("application/json")
                .body("{\"version\":\"2024-10\",\"schemas\":{}}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(400)
                .body(containsString("Schemas are required"));

        verify(mockCoreSchemaStore, never()).getSchemasForVersion(any());
        verify(mockCoreSchemaStore, never()).createSchemaVersion(any(), any());
    }

    @Test
    void return_409_when_schema_version_already_exists() {
        Map<String, Object> existingSchemas = new HashMap<>();
        existingSchemas.put("calm.json", new HashMap<>());
        when(mockCoreSchemaStore.getSchemasForVersion("2024-10")).thenReturn(existingSchemas);

        given()
                .contentType("application/json")
                .body("{\"version\":\"2024-10\",\"schemas\":{\"calm.json\":{}}}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(409)
                .body(containsString("Schema version already exists"));

        verify(mockCoreSchemaStore).getSchemasForVersion("2024-10");
        verify(mockCoreSchemaStore, never()).createSchemaVersion(any(), any());
    }

    @Test
    void return_400_when_request_body_is_null() {
        given()
                .contentType("application/json")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(400)
                .body(containsString("Version is required"));

        verify(mockCoreSchemaStore, never()).getSchemasForVersion(any());
        verify(mockCoreSchemaStore, never()).createSchemaVersion(any(), any());
    }

    @Test
    void trim_whitespace_from_version() {
        when(mockCoreSchemaStore.getSchemasForVersion("2024-10")).thenReturn(null);

        given()
                .contentType("application/json")
                .body("{\"version\":\"  2024-10  \",\"schemas\":{\"calm.json\":{}}}")
                .when()
                .post("/calm/schemas")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/schemas/2024-10/meta"));

        verify(mockCoreSchemaStore).getSchemasForVersion("2024-10");
        verify(mockCoreSchemaStore).createSchemaVersion(eq("2024-10"), ArgumentMatchers.any());
    }

    private void setupMockSchemasForVersion() {
        Map<String, Object> schemasForVersion = new HashMap<>();
        schemasForVersion.put("calm.json", new Object());
        schemasForVersion.put("core.json", TEST_CORE_SCHEMA);
        when(mockCoreSchemaStore.getSchemasForVersion(anyString())).thenReturn(schemasForVersion);
    }

}
