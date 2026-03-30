package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.bson.json.JsonParseException;
import org.finos.calm.domain.Decorator;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2,3]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", null, null);
    }

    @Test
    void return_decorator_ids_filtered_by_target() throws NamespaceNotFoundException {
        String target = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(decoratorStore.getDecoratorsForNamespace("finos", target, null))
                .thenReturn(List.of(1, 2));

        given()
                .queryParam("target", target)
                .when()
                .get("/calm/namespaces/finos/decorators")
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
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2,3]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", null, "deployment");
    }

    @Test
    void return_decorator_ids_filtered_by_target_and_type() throws NamespaceNotFoundException {
        String target = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
        when(decoratorStore.getDecoratorsForNamespace("finos", target, "deployment"))
                .thenReturn(List.of(1, 2));

        given()
                .queryParam("target", target)
                .queryParam("type", "deployment")
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", target, "deployment");
    }

    @Test
    void accept_query_params_with_valid_characters() throws NamespaceNotFoundException {
        String target = "/calm/namespaces/finos-org/architectures/arch_1/versions/1-0-0";
        String type = "deployment_prod";
        when(decoratorStore.getDecoratorsForNamespace("finos", target, type))
                .thenReturn(List.of(1));

        given()
                .queryParam("target", target)
                .queryParam("type", type)
                .when()
                .get("/calm/namespaces/finos/decorators")
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
                .get("/calm/namespaces/empty-namespace/decorators")
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
                .get("/calm/namespaces/invalid-namespace/decorators")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("invalid-namespace", null, null);
    }

    @Test
    void return_400_when_namespace_has_invalid_characters() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/invalid@namespace/decorators")
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
                .get("/calm/namespaces/finos/decorators")
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
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_query_params_have_whitespace() throws NamespaceNotFoundException {
        given()
                .queryParam("target", "  /calm/namespaces/finos/architectures/1  ")
                .queryParam("type", "  deployment  ")
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_400_when_query_params_contain_invalid_characters() throws NamespaceNotFoundException {
        given()
                .queryParam("target", "/calm/namespaces/finos@invalid")
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        given()
                .queryParam("type", "deploy ment")
                .when()
                .get("/calm/namespaces/finos/decorators")
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
                .get("/calm/namespaces/finos/decorators")
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
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }

    @Test
    void return_decorator_by_id_when_exists() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 123;
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of("test-target"))
                .setType("test-type")
                .build();

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenReturn(Optional.of(decorator));

        given()
                .when().get("/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(200)
                .body("target[0]", equalTo("test-target"))
                .body("type", equalTo("test-type"));
    }

    @Test
    void return_404_when_decorator_id_does_not_exist() throws NamespaceNotFoundException {
        String namespace = "test-namespace";
        int decoratorId = 999;

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenReturn(Optional.empty());

        given()
                .when().get("/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 999 does not exist in namespace: test-namespace"));
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_decorator_by_id() throws NamespaceNotFoundException {
        String namespace = "non-existent-namespace";
        int decoratorId = 123;

        when(decoratorStore.getDecoratorById(namespace, decoratorId)).thenThrow(new NamespaceNotFoundException());

        given()
                .when().get("/calm/namespaces/{namespace}/decorators/{id}", namespace, decoratorId)
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: non-existent-namespace"));
    }

    @Test
    void return_400_when_getting_by_id_with_invalid_namespace() {
        String invalidNamespace = "invalid namespace";
        int decoratorId = 123;

        given()
                .when().get("/calm/namespaces/{namespace}/decorators/{id}", invalidNamespace, decoratorId)
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));
    }

    @Test
    void return_404_when_getting_by_id_with_invalid_id_format() {
        String namespace = "test-namespace";
        String invalidId = "invalid-id";

        given()
                .when().get("/calm/namespaces/{namespace}/decorators/{id}", namespace, invalidId)
                .then()
                .statusCode(404);
    }

    @Test
    void return_400_when_id_is_zero() {
        given()
                .when().get("/calm/namespaces/test-namespace/decorators/0")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    @Test
    void return_400_when_id_is_negative() {
        given()
                .when().get("/calm/namespaces/test-namespace/decorators/-1")
                .then()
                .statusCode(400)
                .body(containsString("ID must be a positive integer"));
    }

    @Test
    void accept_id_at_max_int_boundary() throws NamespaceNotFoundException {
        int maxId = Integer.MAX_VALUE;
        when(decoratorStore.getDecoratorById("test-namespace", maxId)).thenReturn(Optional.empty());

        given()
                .when().get("/calm/namespaces/test-namespace/decorators/2147483647")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 2147483647 does not exist in namespace: test-namespace"));
    }

    @Test
    void accept_id_at_min_boundary() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorById("test-namespace", 1)).thenReturn(Optional.empty());

        given()
                .when().get("/calm/namespaces/test-namespace/decorators/1")
                .then()
                .statusCode(404)
                .body(containsString("Decorator with ID 1 does not exist in namespace: test-namespace"));
    }

    @Test
    void return_decorator_values_when_namespace_exists() throws NamespaceNotFoundException {
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of("/calm/namespaces/finos/architectures/1/versions/1-0-0"))
                .setType("deployment")
                .build();
        when(decoratorStore.getDecoratorValuesForNamespace("finos", null, null))
                .thenReturn(List.of(decorator));

        given()
                .when()
                .get("/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("deployment"))
                .body("values[0].target[0]", equalTo("/calm/namespaces/finos/architectures/1/versions/1-0-0"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("finos", null, null);
    }

    @Test
    void return_empty_list_of_values_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorValuesForNamespace("empty-namespace", null, null))
                .thenReturn(List.of());

        given()
                .when()
                .get("/calm/namespaces/empty-namespace/decorators/values")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("empty-namespace", null, null);
    }

    @Test
    void return_decorator_values_filtered_by_target() throws NamespaceNotFoundException {
        String target = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
        Decorator decorator = new Decorator.DecoratorBuilder()
                .setTarget(List.of(target))
                .setType("deployment")
                .build();
        when(decoratorStore.getDecoratorValuesForNamespace("finos", target, null))
                .thenReturn(List.of(decorator));

        given()
                .queryParam("target", target)
                .when()
                .get("/calm/namespaces/finos/decorators/values")
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
                .get("/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(200)
                .body("values[0].type", equalTo("deployment"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("finos", null, "deployment");
    }

    @Test
    void return_decorator_values_filtered_by_target_and_type() throws NamespaceNotFoundException {
        String target = "/calm/namespaces/finos/architectures/1/versions/1-0-0";
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
                .get("/calm/namespaces/finos/decorators/values")
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
                .get("/calm/namespaces/invalid-namespace/decorators/values")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));

        verify(decoratorStore, times(1)).getDecoratorValuesForNamespace("invalid-namespace", null, null);
    }

    @Test
    void return_400_when_namespace_has_invalid_characters_for_decorator_values() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/invalid@namespace/decorators/values")
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
                .get("/calm/namespaces/finos/decorators/values")
                .then()
                .statusCode(400);

        verify(decoratorStore, never()).getDecoratorValuesForNamespace(any(), any(), any());
    }

    // ---- POST /calm/namespaces/{namespace}/decorators ----

    private static final String VALID_DECORATOR_JSON = """
            {
                "$schema": "https://calm.finos.org/draft/2026-03/meta/decorators.json",
                "unique-id": "test-decorator-1",
                "type": "deployment",
                "target": ["/calm/namespaces/finos/architectures/1/versions/1-0-0"],
                "applies-to": ["web-service"],
                "data": {"key": "value"}
            }
            """;

    @Test
    void return_201_with_location_header_when_decorator_created_successfully() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString())).thenReturn(1);

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .post("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/finos/decorators/1"))
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
                .post("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(containsString("Invalid decorator JSON"));
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_create_decorator() throws Exception {
        when(decoratorStore.createDecorator(anyString(), anyString()))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .contentType(ContentType.JSON)
                .body(VALID_DECORATOR_JSON)
                .when()
                .post("/calm/namespaces/invalid-namespace/decorators")
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
                .post("/calm/namespaces/invalid@namespace/decorators")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));
    }
}
