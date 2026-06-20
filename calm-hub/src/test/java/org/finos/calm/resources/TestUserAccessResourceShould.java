package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
public class TestUserAccessResourceShould {

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @Test
    void return_201_created_with_location_header_when_user_access_is_created() throws Exception {
        UserAccess created = new UserAccess();
        created.setNamespace("finos");
        created.setPermission(UserAccess.Permission.read);
        created.setUsername("test_user");
        created.setUserAccessId(101);
        when(mockUserAccessStore.createUserAccessForNamespace(any(UserAccess.class)))
                .thenReturn(created);

        String requestBody = "{\"username\":\"test_user\",\"permission\":\"read\"}";

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/user-access/101"));

        verify(mockUserAccessStore, times(1))
                .createUserAccessForNamespace(any(UserAccess.class));
    }

    @Test
    void return_404_when_creating_user_access_with_invalid_namespace() throws Exception {
        when(mockUserAccessStore.createUserAccessForNamespace(any(UserAccess.class)))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"read\"}")
                .when()
                .post("/api/calm/namespaces/invalid/user-access")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace"));

        verify(mockUserAccessStore, times(1))
                .createUserAccessForNamespace(any(UserAccess.class));
    }

    @Test
    void return_400_when_invalid_namespace_format() throws Exception {
        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"read\"}")
                .when()
                .post("/api/calm/namespaces/invalid_namespace/user-access")
                .then()
                .statusCode(400);
    }

    @Test
    void return_400_when_invalid_username_format() throws Exception {
        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"INVALID USER!\",\"permission\":\"read\"}")
                .when()
                .post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(400);
    }

    @Test
    void return_400_when_double_wildcard_username() throws Exception {
        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"**\",\"permission\":\"read\"}")
                .when()
                .post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(400);
    }

    @Test
    void return_201_when_wildcard_username_is_used() throws Exception {
        UserAccess created = new UserAccess();
        created.setNamespace("finos");
        created.setPermission(UserAccess.Permission.read);
        created.setUsername("*");
        created.setUserAccessId(102);
        when(mockUserAccessStore.createUserAccessForNamespace(any(UserAccess.class)))
                .thenReturn(created);

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"*\",\"permission\":\"read\"}")
                .when()
                .post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/finos/user-access/102"));
    }

    @Test
    void return_500_when_internal_error_occurs_during_user_access_creation() throws Exception {
        when(mockUserAccessStore.createUserAccessForNamespace(any(UserAccess.class)))
                .thenThrow(new RuntimeException("Unexpected error"));

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"read\"}")
                .when()
                .post("/api/calm/namespaces/finos/user-access")
                .then()
                .statusCode(500);

        verify(mockUserAccessStore, times(1))
                .createUserAccessForNamespace(any(UserAccess.class));
    }

    @Test
    void return_200_with_user_access_list_when_namespace_is_valid() throws Exception {
        UserAccess userAccess1 = new UserAccess();
        userAccess1.setUserAccessId(1);
        userAccess1.setUsername("test_user1");
        userAccess1.setNamespace("test");

        UserAccess userAccess2 = new UserAccess();
        userAccess2.setUserAccessId(2);
        userAccess2.setUsername("test_user2");
        userAccess2.setNamespace("test");

        when(mockUserAccessStore.getUserAccessForNamespace("test"))
                .thenReturn(List.of(userAccess1, userAccess2));

        given()
                .when()
                .get("/api/calm/namespaces/test/user-access")
                .then()
                .statusCode(200)
                .body(containsString("test_user1"))
                .body(containsString("test_user2"));

        verify(mockUserAccessStore, times(1))
                .getUserAccessForNamespace("test");
    }

    @Test
    void return_404_when_getting_user_access_for_invalid_namespace() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace("invalid"))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/invalid/user-access")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace"));

        verify(mockUserAccessStore, times(1)).getUserAccessForNamespace("invalid");
    }

    @Test
    void return_200_with_empty_list_when_namespace_has_no_grants() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace("test"))
                .thenReturn(java.util.Collections.emptyList());

        given()
                .when()
                .get("/api/calm/namespaces/test/user-access")
                .then()
                .statusCode(200)
                .body(containsString("[]"));

        verify(mockUserAccessStore, times(1)).getUserAccessForNamespace("test");
    }

    @Test
    void return_500_when_internal_error_occurs_while_getting_user_access() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespace("test"))
                .thenThrow(new RuntimeException("DB error"));

        given()
                .when()
                .get("/api/calm/namespaces/test/user-access")
                .then()
                .statusCode(500);

        verify(mockUserAccessStore, times(1)).getUserAccessForNamespace("test");
    }

    @Test
    void return_200_with_user_access_record_for_provided_namespace_and_user_access_id() throws Exception {
        UserAccess userAccess = new UserAccess();
        userAccess.setUserAccessId(101);
        userAccess.setUsername("test_user1");
        userAccess.setNamespace("test");

        when(mockUserAccessStore.getUserAccessForNamespaceAndId("test", 101))
                .thenReturn(userAccess);

        given()
                .when()
                .get("/api/calm/namespaces/test/user-access/101")
                .then()
                .statusCode(200)
                .body(containsString("test_user1"));

        verify(mockUserAccessStore, times(1))
                .getUserAccessForNamespaceAndId("test", 101);
    }

    @Test
    void return_404_when_user_access_for_invalid_namespace_and_user_access_id() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespaceAndId("invalid", 0))
                .thenThrow(new NamespaceNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/invalid/user-access/0")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace"));

        verify(mockUserAccessStore, times(1))
                .getUserAccessForNamespaceAndId("invalid", 0);
    }

    @Test
    void return_404_when_user_access_for_namespace_and_user_access_id_not_exists() throws Exception {
        when(mockUserAccessStore.getUserAccessForNamespaceAndId("test", 1))
                .thenThrow(new UserAccessNotFoundException());

        given()
                .when()
                .get("/api/calm/namespaces/test/user-access/1")
                .then()
                .statusCode(404)
                .body(containsString("No access permissions found"));

        verify(mockUserAccessStore, times(1))
                .getUserAccessForNamespaceAndId("test", 1);
    }

    @Test
    void return_204_when_user_access_is_deleted() throws Exception {
        doNothing().when(mockUserAccessStore).deleteUserAccessForNamespace("finos", 101);

        given()
                .when()
                .delete("/api/calm/namespaces/finos/user-access/101")
                .then()
                .statusCode(204);

        verify(mockUserAccessStore, times(1)).deleteUserAccessForNamespace("finos", 101);
    }

    @Test
    void return_404_when_deleting_user_access_with_invalid_namespace() throws Exception {
        doThrow(new NamespaceNotFoundException())
                .when(mockUserAccessStore).deleteUserAccessForNamespace("invalid", 1);

        given()
                .when()
                .delete("/api/calm/namespaces/invalid/user-access/1")
                .then()
                .statusCode(404)
                .body(containsString("Invalid namespace"));

        verify(mockUserAccessStore, times(1)).deleteUserAccessForNamespace("invalid", 1);
    }

    @Test
    void return_404_when_deleting_user_access_that_does_not_exist() throws Exception {
        doThrow(new UserAccessNotFoundException())
                .when(mockUserAccessStore).deleteUserAccessForNamespace("finos", 999);

        given()
                .when()
                .delete("/api/calm/namespaces/finos/user-access/999")
                .then()
                .statusCode(404)
                .body(containsString("No access permissions found"));

        verify(mockUserAccessStore, times(1)).deleteUserAccessForNamespace("finos", 999);
    }
}
