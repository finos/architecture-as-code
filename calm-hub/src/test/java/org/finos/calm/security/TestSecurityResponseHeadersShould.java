package org.finos.calm.security;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.store.NamespaceStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.Mockito.when;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestSecurityResponseHeadersShould {

    @InjectMock
    NamespaceStore namespaceStore;

    @Test
    void return_x_frame_options_deny_on_get_request() {
        when(namespaceStore.getNamespaces()).thenReturn(new ArrayList<>());

        given()
                .when()
                .get("/api/calm/namespaces")
                .then()
                .statusCode(200)
                .header("X-Frame-Options", equalTo("DENY"));
    }

    @Test
    void return_x_frame_options_deny_on_post_request() {
        given()
                .contentType("application/json")
                .body("{\"name\":\"test\",\"description\":\"test\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .header("X-Frame-Options", equalTo("DENY"));
    }
}
