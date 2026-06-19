package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@QuarkusTest
@TestProfile(AuthDisabledProfile.class)
public class TestCurrentUserAccessResourceNoAuthShould {

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @Test
    @TestSecurity(user = "alice")
    void return_synthetic_global_admin_grant_when_auth_disabled() {
        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("GLOBAL"))
                .body(containsString("admin"))
                .body(containsString("alice"));

        verify(mockUserAccessStore, never()).getGrantsForUser(any());
    }
}
