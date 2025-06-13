package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.store.NamespaceStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;

@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestNamespaceResourceShould {

    @InjectMock
    NamespaceStore namespaceStore;

    @Test
    void return_empty_wrapper_when_no_namespaces_in_store() {
        when(namespaceStore.getNamespaces()).thenReturn(new ArrayList<>());

        given()
                .when()
                .get("/calm/namespaces")
                .then()
                // Then: Verify the status code is 200 OK and the body contains the expected JSON
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(namespaceStore, times(1)).getNamespaces();
    }

    @Test
    void return_namespaces_when_namespaces_in_store() {
        when(namespaceStore.getNamespaces()).thenReturn(Arrays.asList("finos", "custom"));

        given()
                .when()
                .get("/calm/namespaces")
                .then()
                // Then: Verify the status code is 200 OK and the body contains the expected JSON
                .statusCode(200)
                .body(equalTo("{\"values\":[\"finos\",\"custom\"]}"));

        verify(namespaceStore, times(1)).getNamespaces();
    }

    @Test
    void create_namespace_successfully() {
        when(namespaceStore.namespaceExists("test-namespace")).thenReturn(false);

        given()
                .contentType("application/json")
                .body("{\"namespace\":\"test-namespace\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/test-namespace"));

        verify(namespaceStore).namespaceExists("test-namespace");
        verify(namespaceStore).createNamespace("test-namespace");
    }

    @Test
    void return_400_when_namespace_is_null() {
        given()
                .contentType("application/json")
                .body("{}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Namespace name is required"));

        verify(namespaceStore, never()).namespaceExists(any());
        verify(namespaceStore, never()).createNamespace(any());
    }

    @Test
    void return_400_when_namespace_is_empty() {
        given()
                .contentType("application/json")
                .body("{\"namespace\":\"\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Namespace name is required"));

        verify(namespaceStore, never()).namespaceExists(any());
        verify(namespaceStore, never()).createNamespace(any());
    }

    @Test
    void return_400_when_namespace_contains_invalid_characters() {
        given()
                .contentType("application/json")
                .body("{\"namespace\":\"test@namespace\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Namespace must contain only alphanumeric characters and hyphens"));

        verify(namespaceStore, never()).namespaceExists(any());
        verify(namespaceStore, never()).createNamespace(any());
    }

    @Test
    void return_409_when_namespace_already_exists() {
        when(namespaceStore.namespaceExists("existing-namespace")).thenReturn(true);

        given()
                .contentType("application/json")
                .body("{\"namespace\":\"existing-namespace\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(409)
                .body(containsString("Namespace already exists"));

        verify(namespaceStore).namespaceExists("existing-namespace");
        verify(namespaceStore, never()).createNamespace(any());
    }

    @Test
    void return_400_when_request_body_is_null() {
        given()
                .contentType("application/json")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Namespace name is required"));

        verify(namespaceStore, never()).namespaceExists(any());
        verify(namespaceStore, never()).createNamespace(any());
    }

    @Test
    void trim_whitespace_from_namespace_name() {
        when(namespaceStore.namespaceExists("trimmed-namespace")).thenReturn(false);

        given()
                .contentType("application/json")
                .body("{\"namespace\":\"  trimmed-namespace  \"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/trimmed-namespace"));

        verify(namespaceStore).namespaceExists("trimmed-namespace");
        verify(namespaceStore).createNamespace("trimmed-namespace");
    }
}
