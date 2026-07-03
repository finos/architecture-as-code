package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;

@QuarkusTest
public class TestCurrentUserAccessResourceShould {

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @Test
    @TestSecurity(user = "alice")
    void return_200_with_grants_for_authenticated_user() {
        UserAccess grant = new UserAccess();
        grant.setUsername("alice");
        grant.setNamespace("finos");
        grant.setPermission(UserAccess.Permission.admin);
        grant.setUserAccessId(1);

        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(grant));

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("alice"))
                .body(containsString("finos"));

        verify(mockUserAccessStore, times(1)).getGrantsForUser("alice");
    }

    @Test
    @TestSecurity(user = "bob")
    void return_200_with_empty_list_when_user_has_no_grants() {
        when(mockUserAccessStore.getGrantsForUser("bob")).thenReturn(Collections.emptyList());

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("[]"));

        verify(mockUserAccessStore, times(1)).getGrantsForUser("bob");
    }

    @Test
    @TestSecurity(user = "alice")
    void return_200_including_wildcard_grants_for_implicit_access() {
        UserAccess personalGrant = new UserAccess();
        personalGrant.setUsername("alice");
        personalGrant.setNamespace("finos");
        personalGrant.setPermission(UserAccess.Permission.admin);
        personalGrant.setUserAccessId(1);

        UserAccess wildcardGrant = new UserAccess();
        wildcardGrant.setUsername("*");
        wildcardGrant.setNamespace("finos.open");
        wildcardGrant.setPermission(UserAccess.Permission.read);
        wildcardGrant.setUserAccessId(2);

        when(mockUserAccessStore.getGrantsForUser("alice")).thenReturn(List.of(personalGrant, wildcardGrant));

        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(200)
                .body(containsString("alice"))
                .body(containsString("\"*\""))
                .body(containsString("finos.open"));

        verify(mockUserAccessStore, times(1)).getGrantsForUser("alice");
    }

    @Test
    void return_401_when_not_authenticated() {
        given()
                .when()
                .get("/api/calm/user-access/current")
                .then()
                .statusCode(401);

        verify(mockUserAccessStore, never()).getGrantsForUser(any());
    }
}
