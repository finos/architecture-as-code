package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.DecoratorHistoryEntry;
import org.finos.calm.domain.SchemaValidationLimits;
import org.finos.calm.domain.exception.DecoratorKeyRefusedException;
import org.finos.calm.domain.exception.DecoratorNotFoundException;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestDecoratorResourceShould {

    @InjectMock
    DecoratorStore decoratorStore;

    @Test
    void return_decorator_ids_when_namespace_exists() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("finos", null, null))
                .thenReturn(List.of(1, 2, 3));

        given()
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2,3]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", null, null);
    }

    @Test
    void return_decorator_ids_filtered_by_target() throws NamespaceNotFoundException {
        String target = "/api/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(decoratorStore.getDecoratorsForNamespace("finos", target, null))
                .thenReturn(List.of(1, 2));

        given()
                .queryParam("target", target)
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", target, null);
    }

    @Test
    void return_decorator_ids_filtered_by_type() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("finos", null, "deployment"))
                .thenReturn(List.of(1, 2, 3));

        given()
                .queryParam("type", "deployment")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2,3]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", null, "deployment");
    }

    @Test
    void return_decorator_ids_filtered_by_target_and_type() throws NamespaceNotFoundException {
        String target = "/api/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(decoratorStore.getDecoratorsForNamespace("finos", target, "deployment"))
                .thenReturn(List.of(1, 2));

        given()
                .queryParam("target", target)
                .queryParam("type", "deployment")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", target, "deployment");
    }

    @Test
    void accept_query_params_with_valid_characters() throws NamespaceNotFoundException {
        String target = "/api/calm/namespaces/finos-org/architectures/arch_1/versions/1-0-0";
        String type = "deployment_prod";
        when(decoratorStore.getDecoratorsForNamespace("finos", target, type))
                .thenReturn(List.of(1));

        given()
                .queryParam("target", target)
                .queryParam("type", type)
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", target, type);
    }

    @Test
    void return_empty_list_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("empty-namespace", null, null))
                .thenReturn(List.of());

        given()
                .when()
                .get("/api/calm/namespaces/empty-namespace/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("empty-namespace", null, null);
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_decorators() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("invalid-namespace", null, null))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/invalid-namespace/decorators")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("invalid-namespace", null, null);
    }

    @Test
    void return_400_when_namespace_has_invalid_characters() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/api/calm/namespaces/invalid@namespace/decorators")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_query_params_are_empty_strings() throws NamespaceNotFoundException {
        given()
                .queryParam("target", "")
                .queryParam("type", "")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_query_params_are_only_whitespace() throws NamespaceNotFoundException {
        given()
                .queryParam("target", "   ")
                .queryParam("type", "  ")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_query_params_have_whitespace() throws NamespaceNotFoundException {
        given()
                .queryParam("target", "  /api/calm/namespaces/finos/architectures/1  ")
                .queryParam("type", "  deployment  ")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_query_params_contain_invalid_characters() throws NamespaceNotFoundException {
        given()
                .queryParam("target", "/api/calm/namespaces/finos@invalid")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        given()
                .queryParam("type", "deploy ment")
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_target_exceeds_max_length() throws NamespaceNotFoundException {
        String longTarget = "a".repeat(501);

        given()
                .queryParam("target", longTarget)
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_type_exceeds_max_length() throws NamespaceNotFoundException {
        String longType = "a".repeat(101);

        given()
                .queryParam("type", longType)
                .when()
                .get("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_decorator_by_id_when_exists() throws NamespaceNotFoundException, DecoratorNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 123;
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of("test-target"))
                .setType("test-type")
                .build();

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenReturn(Optional.of(decorator));

        given()
                .when().get("/api/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(200)
                .body("target[0]", equalTo("test-target"))
                .body("type", equalTo("test-type"));
    }

    @Test
    void return_404_when_decorator_id_does_not_exist() throws NamespaceNotFoundException, DecoratorNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 999;

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenReturn(Optional.empty());

        given()
                .when().get("/api/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: test-namespace"));
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_decorator_by_id() throws NamespaceNotFoundException, DecoratorNotFoundException {
        String namespace = "non-existent-namespace";
        int decoratorId = 123;

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenThrow(new NamespaceNotFoundException());

        given()
                .when().get("/api/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: non-existent-namespace"));
    }

    @Test
    void return_404_when_decorator_not_found_exception_thrown_from_get_by_id() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 123;

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenReturn(Optional.empty());

        given()
                .when().get("/api/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 123 does not exist in namespace: test-namespace"));
    }

    @Test
    void return_400_when_getting_by_id_with_invalid_namespace() {
        String invalidNamespace = "invalid namespace";
        int decoratorId = 123;

        given()
                .when().get("/api/calm/namespaces/{namespace}/decorators/{id}", invalidNamespace, decoratorId)
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));
    }

    @Test
    void return_404_when_getting_by_id_with_invalid_id_format() {
        String namespace = "test-namespace";
        String invalidId = "invalid-id";

        given()
                .when().get("/api/calm/namespaces/{namespace}/decorators/{id}", namespace, invalidId)
                .then()
                .statusCode(404);
    }

    @Test
    void return_400_when_id_is_zero() {
        given()
                .when().get("/api/calm/namespaces/test-namespace/decorators/0")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    @Test
    void return_400_when_id_is_negative() {
        given()
                .when().get("/api/calm/namespaces/test-namespace/decorators/-1")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    @Test
    void accept_id_at_max_int_boundary() throws NamespaceNotFoundException, DecoratorNotFoundException {
        int maxId = Integer.MAX_VALUE;
        when(decoratorStore.getDecoratorById("test-namespace", maxId)).thenReturn(Optional.empty());

        given()
                .when().get("/api/calm/namespaces/test-namespace/decorators/2147483647")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 2147483647 does not exist in namespace: test-namespace"));
    }

    @Test
    void accept_id_at_min_boundary() throws NamespaceNotFoundException, DecoratorNotFoundException {
        when(decoratorStore.getDecoratorById("test-namespace", 1)).thenReturn(Optional.empty());

        given()
                .when().get("/api/calm/namespaces/test-namespace/decorators/1")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 1 does not exist in namespace: test-namespace"));
    }

    @Test
    void return_decorator_values_when_namespace_exists() throws NamespaceNotFoundException {
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of("/api/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setType("deployment")
                .build();
        when(decoratorStore.getDecoratorValuesForNamespace("finos", null, null))
                .thenReturn(List.of(decorator));

        given()
                .when()
                .get("/api/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("deployment"))
                .body("values[0].target[0]", equalTo("/api/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("finos", null, null);
    }

    @Test
    void return_empty_list_of_values_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("empty-namespace", null, null))
                .thenReturn(List.of());

        given()
                .when()
                .get("/api/calm/namespaces/empty-namespace/decorators/values")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("empty-namespace", null, null);
    }

    @Test
    void return_decorator_values_filtered_by_target() throws NamespaceNotFoundException {
        String target = "/api/calm/namespaces/finos/architectures/1/versions/1-0-0";
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of(target))
                .setType("deployment")
                .build();
        when(decoratorStore.getDecoratorValuesForNamespace("finos", target, null))
                .thenReturn(List.of(decorator));

        given()
                .queryParam("target", target)
                .when()
                .get("/api/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("deployment"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("finos", target, null);
    }

    @Test
    void return_decorator_values_filtered_by_type() throws NamespaceNotFoundException {
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setType("deployment")
                .build();
        when(decoratorStore.getDecoratorValuesForNamespace("finos", null, "deployment"))
                .thenReturn(List.of(decorator));

        given()
                .queryParam("type", "deployment")
                .when()
                .get("/api/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("deployment"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("finos", null, "deployment");
    }

    @Test
    void return_decorator_values_filtered_by_target_and_type() throws NamespaceNotFoundException {
        String target = "/api/calm/namespaces/finos/architectures/1/versions/1-0-0";
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of(target))
                .setType("deployment")
                .build();
        when(decoratorStore.getDecoratorValuesForNamespace("finos", target, "deployment"))
                .thenReturn(List.of(decorator));

        given()
                .queryParam("target", target)
                .queryParam("type", "deployment")
                .when()
                .get("/api/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("deployment"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("finos", target, "deployment");
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_decorator_values() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("invalid-namespace", null, null))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/invalid-namespace/decorators/values")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("invalid-namespace", null, null);
    }

    @Test
    void return_400_when_namespace_has_invalid_characters_for_decorator_values() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/api/calm/namespaces/invalid@namespace/decorators/values")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verify(decoratorStore, never()).getDecoratorValuesForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_values_query_params_exceed_max_length() throws NamespaceNotFoundException {
        String longTarget = "a".repeat(501);

        given()
                .queryParam("target", longTarget)
                .when()
                .get("/api/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorValuesForNamespace(any(), any(), any());
    }

    // ---- GET /api/calm/namespaces/{namespace}/decorators/{id}/history ----

    @Test
    void return_the_history_of_a_decorator() throws Exception {
        Decorator current = new Decorator.DecoratorBuilder().setUniqueId("eval-2").setType("control-evaluation").build();
        Decorator old = new Decorator.DecoratorBuilder().setUniqueId("eval-1").setType("control-evaluation").build();
        when(decoratorStore.getDecoratorHistory("finos", 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(2, 1, null, current),
                new DecoratorHistoryEntry(1, null, 2, old)));

        given()
                .when()
                .get("/api/calm/namespaces/finos/decorators/1/history")
                .then()
                .statusCode(200)
                .body("values.id", contains(2, 1))
                .body("values[0].supersedes", equalTo(1))
                .body("values[1].supersededBy", equalTo(2))
                .body("values[1].decorator.uniqueId", equalTo("eval-1"));
    }

    @Test
    void return_404_when_the_decorator_of_a_history_does_not_exist() throws Exception {
        when(decoratorStore.getDecoratorHistory("finos", 9)).thenThrow(new DecoratorNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/finos/decorators/9/history")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 9 does not exist in namespace: finos"));
    }

    @Test
    void return_404_when_the_namespace_of_a_history_does_not_exist() throws Exception {
        when(decoratorStore.getDecoratorHistory("missing", 1)).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/missing/decorators/1/history")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: missing"));
    }

    @Test
    void return_400_when_the_history_path_is_invalid() throws Exception {
        given()
                .when()
                .get("/api/calm/namespaces/invalid@namespace/decorators/1/history")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        given()
                .when()
                .get("/api/calm/namespaces/finos/decorators/0/history")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));

        verify(decoratorStore, never()).getDecoratorHistory(anyString(), anyInt());
    }

    // ---- POST /api/calm/namespaces/{namespace}/decorators ----

    private static final String VALID_DECORATOR_JSON = """
            {
                "$schema": "https://calm.finos.org/standards/deployment/1.0/deployment.decorator.standard.json",
                "unique-id": "test-decorator-1",
                "type": "deployment",
                "target": ["/api/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "target-type": ["architecture"],
                "applies-to": ["web-service"],
                "data": {"start-time": "2026-02-23T10:00:00Z", "status": "completed"}
            }
            """;

    @Test
    void return_201_with_location_header_when_decorator_created_successfully() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString())).thenReturn(1);

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/decorators/1"))
                .body("id", equalTo(1));
    }

    @Test
    void return_400_when_decorator_json_is_invalid() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString()))
                .thenThrow(new JsonParseException("Invalid JSON"));

        given()
                .contentType(ContentType.JSON)
                .body("not-valid-json")
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(containsString("Invalid decorator JSON"));
    }

    @Test
    void never_echo_the_text_of_a_parse_error() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString()))
                .thenThrow(new JsonParseException("Unrecognized token '<script>alert(1)</script>'"));

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(equalTo(CalmResourceErrorResponses.INVALID_DECORATOR_JSON))
                .body(not(containsString("script")));
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_create_decorator() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/invalid-namespace/decorators")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));
    }

    @Test
    void return_400_when_namespace_has_invalid_characters_for_create_decorator() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .post("/api/calm/namespaces/invalid@namespace/decorators")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));
    }

    @Test
    void return_400_with_the_errors_when_a_decorator_does_not_match_a_known_schema() throws Exception {
        assumeMetaSchemasBuilt();
        String invalid = VALID_DECORATOR_JSON.replace("\"status\": \"completed\"", "\"status\": \"done\"");

        given()
                .contentType(ContentType.JSON)
                .body(invalid)
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body("error", equalTo("Decorator does not match its $schema"))
                .body("errors.location", hasItem("/data/status"));

        verify(decoratorStore, never()).createDecorator(anyString(), anyString());
    }

    @Test
    void accept_a_decorator_with_an_unknown_schema() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString())).thenReturn(2);

        given()
                .contentType(ContentType.JSON)
                .body("{\"$schema\": \"https://example.com/my.decorator.json\", \"type\": \"deployment\", \"data\": 1}")
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201);
    }

    @Test
    void return_400_with_the_errors_when_an_update_does_not_match_a_known_schema() throws Exception {
        assumeMetaSchemasBuilt();
        String invalid = VALID_DECORATOR_JSON.replace("\"target-type\": [\"architecture\"],", "");

        given()
                .contentType(ContentType.JSON)
                .body(invalid)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(400)
                .body("errors.size()", greaterThan(0));

        verify(decoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    // ---- PUT /api/calm/namespaces/{namespace}/decorators/{id} ----

    @Test
    void return_200_when_decorator_updated_successfully() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(200);

        verify(decoratorStore, times(1)).updateDecorator(
                org.mockito.ArgumentMatchers.eq("finos"),
                org.mockito.ArgumentMatchers.eq(1),
                argThat(json -> json != null && json.strip().equals(VALID_DECORATOR_JSON.strip()))
        );
    }

    @Test
    void return_404_when_decorator_not_found_for_update() throws Exception {
        doThrow(new DecoratorNotFoundException())
                .when(decoratorStore).updateDecorator(anyString(), anyInt(), anyString());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/finos/decorators/999")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: finos"));
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_update_decorator() throws Exception {
        doThrow(new NamespaceNotFoundException())
                .when(decoratorStore).updateDecorator(anyString(), anyInt(), anyString());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/invalid-namespace/decorators/1")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));
    }

    @Test
    void return_400_with_a_plain_message_when_the_store_cannot_keep_a_key_on_create() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString())).thenThrow(DecoratorKeyRefusedException.nulCharacter());

        given()
                .contentType(ContentType.JSON)
                .body("{\"type\": \"deployment\", \"data\": {}}")
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(equalTo(DecoratorKeyRefusedException.nulCharacter().getMessage()));
    }

    @Test
    void return_400_with_a_plain_message_when_the_store_cannot_keep_a_key_on_update() throws Exception {
        doThrow(DecoratorKeyRefusedException.emptyKeyPart())
                .when(decoratorStore).updateDecorator(anyString(), anyInt(), anyString());

        given()
                .contentType(ContentType.JSON)
                .body("{\"type\": \"deployment\", \"data\": {}}")
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(400)
                .body(equalTo(DecoratorKeyRefusedException.emptyKeyPart().getMessage()));
    }

    @Test
    void return_413_when_a_created_decorator_is_over_the_size_limit() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body(decoratorOfBytes(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + 1))
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(413)
                .body(equalTo("The decorator JSON is larger than 1048576 bytes"));

        verify(decoratorStore, never()).createDecorator(anyString(), anyString());
    }

    @Test
    void return_413_when_an_updated_decorator_is_over_the_size_limit() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body(decoratorOfBytes(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES + 1))
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(413);

        verify(decoratorStore, never()).getDecoratorById(anyString(), anyInt());
        verify(decoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void accept_a_decorator_of_exactly_the_size_limit() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString())).thenReturn(1);

        given()
                .contentType(ContentType.JSON)
                .body(decoratorOfBytes(SchemaValidationLimits.MAX_DECORATOR_JSON_BYTES))
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201);
    }

    private static String decoratorOfBytes(int bytes) {
        String prefix = "{\"data\": \"";
        String suffix = "\"}";
        return prefix + "x".repeat(bytes - prefix.length() - suffix.length()) + suffix;
    }

    @Test
    void return_400_when_update_decorator_json_is_invalid() throws Exception {
        doThrow(new JsonParseException("Invalid JSON"))
                .when(decoratorStore).updateDecorator(anyString(), anyInt(), anyString());

        given()
                .contentType(ContentType.JSON)
                .body("not-valid-json")
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(400)
                .body(containsString("Invalid decorator JSON"));
    }

    @Test
    void return_400_when_a_created_decorator_has_a_type_that_is_not_a_string() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body("{\"type\": 5, \"data\": {}}")
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(equalTo(CalmResourceErrorResponses.INVALID_DECORATOR_JSON));

        verify(decoratorStore, never()).createDecorator(anyString(), anyString());
    }

    @Test
    void return_400_when_a_created_decorator_has_a_unique_id_that_is_not_a_string() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body("{\"unique-id\": 7, \"type\": \"x\"}")
                .when()
                .post("/api/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(equalTo(CalmResourceErrorResponses.INVALID_DECORATOR_JSON));

        verify(decoratorStore, never()).createDecorator(anyString(), anyString());
    }

    @Test
    void return_400_when_an_updated_decorator_has_a_target_that_is_not_an_array_of_strings() throws Exception {
        given()
                .contentType(ContentType.JSON)
                .body("{\"type\": \"threat-model\", \"target\": \"t\"}")
                .when()
                .put("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(400)
                .body(equalTo(CalmResourceErrorResponses.INVALID_DECORATOR_JSON));

        verify(decoratorStore, never()).updateDecorator(anyString(), anyInt(), anyString());
    }

    @Test
    void return_400_when_namespace_has_invalid_characters_for_update_decorator() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/invalid@namespace/decorators/1")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));
    }

    @Test
    void return_400_when_put_id_is_zero() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/test-namespace/decorators/0")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    @Test
    void return_400_when_put_id_is_negative() {
        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .put("/api/calm/namespaces/test-namespace/decorators/-1")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    // ---- DELETE /api/calm/namespaces/{namespace}/decorators/{id} ----

    @Test
    void return_204_when_decorator_deleted_successfully() throws Exception {
        when(decoratorStore.getDecoratorHistory("finos", 1)).thenReturn(List.of(
                new DecoratorHistoryEntry(1, null, null, new Decorator.DecoratorBuilder().setType("deployment").build())));

        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/1")
                .then()
                .statusCode(204);

        verify(decoratorStore, times(1)).deleteCurrentDecoratorHistory("finos", 1);
    }

    @Test
    void return_404_when_decorator_not_found_for_delete() throws Exception {
        when(decoratorStore.getDecoratorHistory(anyString(), anyInt())).thenThrow(new DecoratorNotFoundException());

        given()
                .when()
                .delete("/api/calm/namespaces/finos/decorators/999")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: finos"));
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_delete_decorator() throws Exception {
        when(decoratorStore.getDecoratorHistory(anyString(), anyInt())).thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .delete("/api/calm/namespaces/invalid-namespace/decorators/1")
                .then()
                .statusCode(404);
    }

    @Test
    void return_400_when_namespace_has_invalid_characters_for_delete_decorator() {
        given()
                .when()
                .delete("/api/calm/namespaces/invalid@namespace/decorators/1")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));
    }

    @Test
    void return_400_when_delete_id_is_zero() {
        given()
                .when()
                .delete("/api/calm/namespaces/test-namespace/decorators/0")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    // -Pserver-only and -Dskip.npm do not copy the meta-schemas that the decorator Standards reference.
    private static void assumeMetaSchemasBuilt() {
        assumeTrue(Files.exists(Path.of("target", "classes", "META-INF", "calm-schemas", "1.3", "meta", "decorators.json")),
                "run a full build (without -Pserver-only or -Dskip.npm) first");
    }
}
