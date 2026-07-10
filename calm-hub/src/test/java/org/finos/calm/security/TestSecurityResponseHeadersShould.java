package org.finos.calm.security;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.response.ValidatableResponse;
import org.finos.calm.store.NamespaceStore;
import org.finos.calm.store.UserAccessStore;
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
    NamespaceStore mockNamespaceStore;

    @InjectMock
    UserAccessStore mockUserAccessStore;

    private static void assertSecurityHeaders(ValidatableResponse response) {
        response
                .header("X-Frame-Options", equalTo("DENY"))
                .header("X-Content-Type-Options", equalTo("nosniff"))
                .header("Referrer-Policy", equalTo("no-referrer"));
    }

    @Test
    void return_security_headers_on_get_request() {
        when(mockNamespaceStore.getNamespaces()).thenReturn(new ArrayList<>());

        assertSecurityHeaders(given()
                .when()
                .get("/api/calm/namespaces")
                .then()
                .statusCode(200));
    }

    @Test
    void return_security_headers_on_head_request() {
        when(mockNamespaceStore.getNamespaces()).thenReturn(new ArrayList<>());

        assertSecurityHeaders(given()
                .when()
                .head("/api/calm/namespaces")
                .then()
                .statusCode(200));
    }

    @Test
    void return_security_headers_on_post_request() {
        assertSecurityHeaders(given()
                .contentType("application/json")
                .body("{\"name\":\"test\",\"description\":\"test\"}")
                .when()
                .post("/api/calm/namespaces")
                .then());
    }
}
