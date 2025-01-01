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
}
