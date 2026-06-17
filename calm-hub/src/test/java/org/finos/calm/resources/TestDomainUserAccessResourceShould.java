package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.DomainStore;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
public class TestDomainUserAccessResourceShould {

    @InjectMock
    UserAccessStore mockUserAccessStore;

    @InjectMock
    DomainStore mockDomainStore;

    @BeforeEach
    void defaultDomainExists() {
        lenient().when(mockDomainStore.domainExists(anyString())).thenReturn(true);
    }

    @Test
    void return_400_when_invalid_domain_format_provided_on_create_user_access() {
        given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post("/api/calm/domains/invalid_domain/user-access")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_400_when_invalid_domain_format_provided_on_get_user_access() {
        given()
                .when()
                .get("/api/calm/domains/invalid_domain/user-access")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_400_when_invalid_domain_format_provided_on_get_user_access_by_id() {
        given()
                .when()
                .get("/api/calm/domains/invalid_domain/user-access/1")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_201_created_with_location_header_when_domain_user_access_is_created() {
        UserAccess created = new UserAccess();
        created.setDomain("payments");
        created.setPermission(UserAccess.Permission.write);
        created.setUsername("test_user");
        created.setUserAccessId(201);
        when(mockUserAccessStore.createUserAccessForDomain(any(UserAccess.class))).thenReturn(created);

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"write\"}")
                .when()
                .post("/api/calm/domains/payments/user-access")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/domains/payments/user-access/201"));

        verify(mockUserAccessStore, times(1)).createUserAccessForDomain(any(UserAccess.class));
    }

    @Test
    void return_500_when_store_returns_domain_that_causes_uri_syntax_error() {
        UserAccess invalid = new UserAccess();
        invalid.setDomain("payments invalid");
        invalid.setUserAccessId(1);
        when(mockUserAccessStore.createUserAccessForDomain(any(UserAccess.class))).thenReturn(invalid);

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"write\"}")
                .when()
                .post("/api/calm/domains/payments/user-access")
                .then()
                .statusCode(500)
                .body(containsString("System Malfunction"));

        verify(mockUserAccessStore, times(1)).createUserAccessForDomain(any(UserAccess.class));
    }

    @Test
    void return_500_when_internal_error_occurs_during_domain_user_access_creation() {
        when(mockUserAccessStore.createUserAccessForDomain(any(UserAccess.class)))
                .thenThrow(new RuntimeException("Unexpected error"));

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"write\"}")
                .when()
                .post("/api/calm/domains/payments/user-access")
                .then()
                .statusCode(500);

        verify(mockUserAccessStore, times(1)).createUserAccessForDomain(any(UserAccess.class));
    }

    @Test
    void return_200_with_user_access_list_for_domain() throws Exception {
        UserAccess ua1 = new UserAccess();
        ua1.setUserAccessId(201);
        ua1.setUsername("test_user1");
        ua1.setDomain("payments");

        UserAccess ua2 = new UserAccess();
        ua2.setUserAccessId(202);
        ua2.setUsername("test_user2");
        ua2.setDomain("payments");

        when(mockUserAccessStore.getUserAccessForDomain("payments")).thenReturn(List.of(ua1, ua2));

        given()
                .when()
                .get("/api/calm/domains/payments/user-access")
                .then()
                .statusCode(200)
                .body(containsString("test_user1"))
                .body(containsString("test_user2"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomain("payments");
    }

    @Test
    void return_200_with_empty_list_when_domain_has_no_grants() {
        when(mockUserAccessStore.getUserAccessForDomain("payments")).thenReturn(Collections.emptyList());

        given()
                .when()
                .get("/api/calm/domains/payments/user-access")
                .then()
                .statusCode(200)
                .body(containsString("[]"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomain("payments");
    }

    @Test
    void return_500_when_internal_error_occurs_while_getting_domain_user_access() throws Exception {
        when(mockUserAccessStore.getUserAccessForDomain("payments"))
                .thenThrow(new RuntimeException("DB error"));

        given()
                .when()
                .get("/api/calm/domains/payments/user-access")
                .then()
                .statusCode(500);

        verify(mockUserAccessStore, times(1)).getUserAccessForDomain("payments");
    }

    @Test
    void return_200_with_user_access_record_for_domain_and_id() throws Exception {
        UserAccess ua = new UserAccess();
        ua.setUserAccessId(201);
        ua.setUsername("test_user");
        ua.setDomain("payments");
        when(mockUserAccessStore.getUserAccessForDomainAndId("payments", 201)).thenReturn(ua);

        given()
                .when()
                .get("/api/calm/domains/payments/user-access/201")
                .then()
                .statusCode(200)
                .body(containsString("test_user"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomainAndId("payments", 201);
    }

    @Test
    void return_404_when_user_access_for_domain_and_id_not_found() throws Exception {
        when(mockUserAccessStore.getUserAccessForDomainAndId("payments", 999))
                .thenThrow(new UserAccessNotFoundException());

        given()
                .when()
                .get("/api/calm/domains/payments/user-access/999")
                .then()
                .statusCode(404)
                .body(containsString("No access permissions found"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomainAndId("payments", 999);
    }

    @Test
    void return_204_when_domain_user_access_is_deleted() throws Exception {
        doNothing().when(mockUserAccessStore).deleteUserAccessForDomain("payments", 201);

        given()
                .when()
                .delete("/api/calm/domains/payments/user-access/201")
                .then()
                .statusCode(204);

        verify(mockUserAccessStore, times(1)).deleteUserAccessForDomain("payments", 201);
    }

    @Test
    void return_404_when_deleting_domain_user_access_that_does_not_exist() throws Exception {
        doThrow(new UserAccessNotFoundException())
                .when(mockUserAccessStore).deleteUserAccessForDomain("payments", 999);

        given()
                .when()
                .delete("/api/calm/domains/payments/user-access/999")
                .then()
                .statusCode(404)
                .body(containsString("No access permissions found"));

        verify(mockUserAccessStore, times(1)).deleteUserAccessForDomain("payments", 999);
    }

    @Test
    void return_400_when_invalid_domain_format_provided_on_delete_user_access() {
        given()
                .when()
                .delete("/api/calm/domains/invalid_domain/user-access/1")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_404_when_domain_does_not_exist_on_create_user_access() {
        when(mockDomainStore.domainExists("unknown")).thenReturn(false);

        given()
                .header("Content-Type", "application/json")
                .body("{\"username\":\"test_user\",\"permission\":\"write\"}")
                .when()
                .post("/api/calm/domains/unknown/user-access")
                .then()
                .statusCode(404)
                .body(containsString("Invalid domain provided: unknown"));

        verify(mockUserAccessStore, never()).createUserAccessForDomain(any());
    }

    @Test
    void return_404_when_domain_does_not_exist_on_get_user_access() {
        when(mockDomainStore.domainExists("unknown")).thenReturn(false);

        given()
                .when()
                .get("/api/calm/domains/unknown/user-access")
                .then()
                .statusCode(404)
                .body(containsString("Invalid domain provided: unknown"));

        verify(mockUserAccessStore, never()).getUserAccessForDomain(any());
    }

    @Test
    void return_404_when_domain_does_not_exist_on_get_user_access_by_id() throws Exception {
        when(mockDomainStore.domainExists("unknown")).thenReturn(false);

        given()
                .when()
                .get("/api/calm/domains/unknown/user-access/1")
                .then()
                .statusCode(404)
                .body(containsString("Invalid domain provided: unknown"));

        verify(mockUserAccessStore, never()).getUserAccessForDomainAndId(any(), any());
    }

    @Test
    void return_404_when_domain_does_not_exist_on_delete_user_access() throws Exception {
        when(mockDomainStore.domainExists("unknown")).thenReturn(false);

        given()
                .when()
                .delete("/api/calm/domains/unknown/user-access/1")
                .then()
                .statusCode(404)
                .body(containsString("Invalid domain provided: unknown"));

        verify(mockUserAccessStore, never()).deleteUserAccessForDomain(any(), any());
    }
}
