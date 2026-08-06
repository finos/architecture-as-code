package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ArchitectureStore;
import org.finos.calm.store.LayoutStore;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Optional;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
public class TestLayoutResourceShould {

    @InjectMock
    LayoutStore mockLayoutStore;

    @InjectMock
    ArchitectureStore mockArchitectureStore;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    private void givenArchitectureExists() throws NamespaceNotFoundException {
        when(mockArchitectureStore.architectureExists("finos", 5)).thenReturn(true);
    }

    private static final String VALID_LAYOUT_JSON = """
            {
                "for": "/api/calm/namespaces/finos/architectures/5",
                "name": "Default",
                "pins": [
                    { "unique-id": "node-a", "position": { "x": 0, "y": 0 } }
                ]
            }
            """;

    // ---- GET /api/calm/namespaces/{namespace}/architectures/{architectureId}/layout ----

    @Test
    void return_layout_when_saved() throws NamespaceNotFoundException {
        when(mockLayoutStore.getLayout("finos", 5)).thenReturn(Optional.of(VALID_LAYOUT_JSON));

        given()
                .when()
                .get("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(200)
                .body("for", equalTo("/api/calm/namespaces/finos/architectures/5"))
                .body("pins[0].unique-id", equalTo("node-a"));

        verify(mockLayoutStore, times(1)).getLayout("finos", 5);
    }

    @Test
    void return_404_when_no_layout_saved() throws NamespaceNotFoundException {
        when(mockLayoutStore.getLayout("finos", 5)).thenReturn(Optional.empty());

        given()
                .when()
                .get("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for architecture 5 in namespace: finos"));
    }

    @Test
    void return_404_when_namespace_not_found_for_get_layout() throws NamespaceNotFoundException {
        when(mockLayoutStore.getLayout("missing", 5)).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/missing/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: missing"));
    }

    @Test
    void return_400_when_namespace_invalid_for_get_layout() {
        given()
                .when()
                .get("/api/calm/namespaces/invalid@namespace/architectures/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verifyNoInteractions(mockLayoutStore);
    }

    @Test
    void return_400_when_architecture_id_is_zero_for_get_layout() {
        given()
                .when()
                .get("/api/calm/namespaces/finos/architectures/0/layout")
                .then()
                .statusCode(400)
                .body(containsString("Architecture ID must be a positive integer"));

        verifyNoInteractions(mockLayoutStore);
    }

    // ---- PUT /api/calm/namespaces/{namespace}/architectures/{architectureId}/layout ----

    @Test
    void return_204_when_layout_saved() throws NamespaceNotFoundException {
        givenArchitectureExists();

        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(204);

        verify(mockLayoutStore, times(1)).upsertLayout(
                eq("finos"), eq(5), argThat(json -> json != null && json.strip().equals(VALID_LAYOUT_JSON.strip())));
    }

    @Test
    void accept_put_when_for_is_absent() throws NamespaceNotFoundException {
        givenArchitectureExists();
        String layoutWithoutFor = "{ \"pins\": [] }";

        given()
                .contentType(ContentType.JSON)
                .body(layoutWithoutFor)
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(204);

        verify(mockLayoutStore, times(1)).upsertLayout(eq("finos"), eq(5), anyString());
    }

    @Test
    void return_400_when_for_target_does_not_match_architecture() {
        String mismatchedLayout = """
                { "for": "/api/calm/namespaces/finos/architectures/999", "pins": [] }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(mismatchedLayout)
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("does not match architecture"));

        verifyNoInteractions(mockLayoutStore);
        verifyNoInteractions(mockArchitectureStore);
    }

    @Test
    void return_400_when_layout_json_is_invalid() {
        given()
                .contentType(ContentType.JSON)
                .body("not-valid-json")
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("The layout JSON could not be parsed"));

        verifyNoInteractions(mockLayoutStore);
        verifyNoInteractions(mockArchitectureStore);
    }

    @Test
    void return_400_rather_than_500_when_the_layout_body_is_absent() {
        // An absent body binds to layoutJson = "" here (empirically confirmed), not null —
        // Document.parse("") threw an uncaught BsonInvalidOperationException (500) before
        // parseForTarget started rejecting a null-or-blank body up front.
        given()
                .contentType(ContentType.JSON)
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("The layout JSON could not be parsed"));

        verifyNoInteractions(mockLayoutStore);
        verifyNoInteractions(mockArchitectureStore);
    }

    @Test
    void return_400_rather_than_500_when_the_layout_body_is_an_empty_string() {
        given()
                .contentType(ContentType.JSON)
                .body("")
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("The layout JSON could not be parsed"));

        verifyNoInteractions(mockLayoutStore);
        verifyNoInteractions(mockArchitectureStore);
    }

    @Test
    void return_404_when_architecture_does_not_exist_for_put_layout() throws NamespaceNotFoundException {
        when(mockArchitectureStore.architectureExists("finos", 5)).thenReturn(false);

        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("Architecture 5 does not exist in namespace: finos"));

        verify(mockLayoutStore, never()).upsertLayout(anyString(), anyInt(), anyString());
    }

    @Test
    void return_404_when_namespace_not_found_for_put_layout() throws NamespaceNotFoundException {
        doThrow(new NamespaceNotFoundException()).when(mockArchitectureStore).architectureExists(anyString(), anyInt());

        given()
                .contentType(ContentType.JSON)
                .body("{ \"pins\": [] }")
                .when()
                .put("/api/calm/namespaces/missing/architectures/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: missing"));

        verifyNoInteractions(mockLayoutStore);
    }

    @Test
    void return_400_when_namespace_invalid_for_put_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/invalid@namespace/architectures/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verifyNoInteractions(mockLayoutStore);
    }

    @Test
    void return_400_when_architecture_id_is_zero_for_put_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/architectures/0/layout")
                .then()
                .statusCode(400)
                .body(containsString("Architecture ID must be a positive integer"));

        verifyNoInteractions(mockLayoutStore);
    }

    @Test
    @TestSecurity(user = "bob")
    void return_403_when_write_scope_missing_for_put_layout() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(Collections.emptyList());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/architectures/5/layout")
                .then()
                .statusCode(403);

        verifyNoInteractions(mockLayoutStore);
        verifyNoInteractions(mockArchitectureStore);
    }
}
