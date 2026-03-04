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
        when(decoratorStore.getDecoratorsForNamespace("finos"))
                .thenReturn(List.of(1, 2));

        given()
                .when()
                .get("/calm/namespaces/finos/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[1,2]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("finos");
    }

    @Test
    void return_empty_list_when_namespace_has_no_decorators() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("empty-namespace"))
                .thenReturn(List.of());

        given()
                .when()
                .get("/calm/namespaces/empty-namespace/decorators")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("empty-namespace");
    }

    @Test
    void return_404_when_namespace_does_not_exist_for_decorators() throws NamespaceNotFoundException {
        when(decoratorStore.getDecoratorsForNamespace("invalid-namespace"))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/calm/namespaces/invalid-namespace/decorators")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace provided: invalid-namespace"));

        verify(decoratorStore, times(1)).getDecoratorsForNamespace("invalid-namespace");
    }

    @Test
    void return_400_when_namespace_has_invalid_characters() throws NamespaceNotFoundException {
        given()
                .when()
                .get("/calm/namespaces/invalid@namespace/decorators")
                .then()
                .statusCode(400)
                .body(containsString("namespace must match pattern"));

        verify(decoratorStore, never()).getDecoratorsForNamespace(any());
    }
}
