package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.DecoratorStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.*;

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
    void treat_empty_string_query_params_as_null() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("finos", null, null))
                .thenReturn(List.of(1, 2, 3));

        given()
                .queryParam("target", "")
                .queryParam("type", "")
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2,3]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", null, null);
    }

    @Test
    void treat_whitespace_query_params_as_null() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("finos", null, null))
                .thenReturn(List.of(1));

        given()
                .queryParam("target", "   ")
                .queryParam("type", "  ")
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", null, null);
    }

    @Test
    void trim_query_params() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("finos", "/calm/namespaces/finos/architectures/1", "deployment"))
                .thenReturn(List.of(1));

        given()
                .queryParam("target", "  /calm/namespaces/finos/architectures/1  ")
                .queryParam("type", "  deployment  ")
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos", "/calm/namespaces/finos/architectures/1", "deployment");
    }

    @Test
    void return_400_when_target_exceeds_max_length() throws NamespaceNotFoundException {
        String longTarget = "a".repeat(501);

        given()
                .queryParam("target", longTarget)
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(400)
                .body(containsString("exceeds maximum length"));

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
                .statusCode(400)
                .body(containsString("exceeds maximum length"));

        verify(decoratorStore, never()).getDecoratorsForNamespace(any(), any(), any());
    }
}
