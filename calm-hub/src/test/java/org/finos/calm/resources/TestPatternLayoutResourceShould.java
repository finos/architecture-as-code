package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.PatternNotFoundException;
import org.finos.calm.store.PatternLayoutStore;
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
public class TestPatternLayoutResourceShould {

    @InjectMock
    PatternLayoutStore mockPatternLayoutStore;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    private static final String VALID_LAYOUT_JSON = """
            {
                "for": "/api/calm/namespaces/finos/patterns/5",
                "name": "Default",
                "pins": [
                    { "unique-id": "node-a", "position": { "x": 0, "y": 0 } }
                ]
            }
            """;

    // ---- GET /api/calm/namespaces/{namespace}/patterns/{patternId}/layout ----

    @Test
    void return_layout_when_saved() throws NamespaceNotFoundException {
        when(mockPatternLayoutStore.getLayout("finos", 5)).thenReturn(Optional.of(VALID_LAYOUT_JSON));

        given()
                .when()
                .get("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(200)
                .body("for", equalTo("/api/calm/namespaces/finos/patterns/5"))
                .body("pins[0].unique-id", equalTo("node-a"));

        verify(mockPatternLayoutStore, times(1)).getLayout("finos", 5);
    }

    @Test
    void return_404_when_no_layout_saved() throws NamespaceNotFoundException {
        when(mockPatternLayoutStore.getLayout("finos", 5)).thenReturn(Optional.empty());

        given()
                .when()
                .get("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("No default layout saved for pattern 5 in namespace: finos"));
    }

    @Test
    void return_404_when_namespace_not_found_for_get_layout() throws NamespaceNotFoundException {
        when(mockPatternLayoutStore.getLayout("missing", 5)).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/missing/patterns/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: missing"));
    }

    @Test
    void return_400_when_namespace_invalid_for_get_layout() {
        given()
                .when()
                .get("/api/calm/namespaces/invalid@namespace/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_400_when_pattern_id_is_zero_for_get_layout() {
        given()
                .when()
                .get("/api/calm/namespaces/finos/patterns/0/layout")
                .then()
                .statusCode(400)
                .body(containsString("Pattern ID must be a positive integer"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    // ---- PUT /api/calm/namespaces/{namespace}/patterns/{patternId}/layout ----

    @Test
    void return_204_when_layout_saved() throws NamespaceNotFoundException, PatternNotFoundException {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(204);

        verify(mockPatternLayoutStore, times(1)).upsertLayout(
                eq("finos"), eq(5), argThat(json -> json != null && json.strip().equals(VALID_LAYOUT_JSON.strip())));
    }

    @Test
    void accept_put_when_for_is_absent() throws NamespaceNotFoundException, PatternNotFoundException {
        String layoutWithoutFor = "{ \"pins\": [] }";

        given()
                .contentType(ContentType.JSON)
                .body(layoutWithoutFor)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(204);

        verify(mockPatternLayoutStore, times(1)).upsertLayout(eq("finos"), eq(5), anyString());
    }

    @Test
    void return_400_when_for_target_does_not_match_pattern() {
        String mismatchedLayout = """
                { "for": "/api/calm/namespaces/finos/patterns/999", "pins": [] }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(mismatchedLayout)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("does not match pattern"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_400_when_for_target_names_the_architecture_path_for_the_same_numeric_id() {
        // Architecture ids and pattern ids are drawn from independent counters (see
        // MongoCounterStore), so a request could legitimately try to save a pattern's layout
        // with a `for` that names an architecture with the same numeric id. The plain
        // equality check against this resource's own pattern-canonical path already rejects
        // it, exactly like any other mismatched target — no separate cross-type case needed.
        String architecturePathLayout = """
                { "for": "/api/calm/namespaces/finos/architectures/5", "pins": [] }
                """;

        given()
                .contentType(ContentType.JSON)
                .body(architecturePathLayout)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("does not match pattern"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_400_when_layout_json_is_invalid() {
        given()
                .contentType(ContentType.JSON)
                .body("not-valid-json")
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("The layout JSON could not be parsed"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_400_rather_than_500_when_the_layout_body_is_absent() {
        given()
                .contentType(ContentType.JSON)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("The layout JSON could not be parsed"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_400_rather_than_500_when_the_layout_body_is_an_empty_string() {
        given()
                .contentType(ContentType.JSON)
                .body("")
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("The layout JSON could not be parsed"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_404_when_pattern_does_not_exist_for_put_layout()
            throws NamespaceNotFoundException, PatternNotFoundException {
        doThrow(new PatternNotFoundException())
                .when(mockPatternLayoutStore).upsertLayout(eq("finos"), eq(5), anyString());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("Pattern 5 does not exist in namespace: finos"));
    }

    @Test
    void return_404_when_namespace_not_found_for_put_layout()
            throws NamespaceNotFoundException, PatternNotFoundException {
        doThrow(new NamespaceNotFoundException())
                .when(mockPatternLayoutStore).upsertLayout(anyString(), anyInt(), anyString());

        given()
                .contentType(ContentType.JSON)
                .body("{ \"pins\": [] }")
                .when()
                .put("/api/calm/namespaces/missing/patterns/5/layout")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: missing"));
    }

    @Test
    void return_400_when_namespace_invalid_for_put_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/invalid@namespace/patterns/5/layout")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    void return_400_when_pattern_id_is_zero_for_put_layout() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/patterns/0/layout")
                .then()
                .statusCode(400)
                .body(containsString("Pattern ID must be a positive integer"));

        verifyNoInteractions(mockPatternLayoutStore);
    }

    @Test
    @TestSecurity(user = "bob")
    void return_403_when_write_scope_missing_for_put_layout() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(Collections.emptyList());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_LAYOUT_JSON)
                .when()
                .put("/api/calm/namespaces/finos/patterns/5/layout")
                .then()
                .statusCode(403);

        verifyNoInteractions(mockPatternLayoutStore);
    }
}
