package org.finos.calm.resources;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.Test;

import java.util.List;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.DOMAIN_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
public class TestDomainUserAccessResourceShould {

    @InjectMock
    UserAccessStore mockUserAccessStore;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void return_400_when_invalid_domain_format_provided_on_create_user_access() {
        given()
                .header("Content-Type", "application/json")
                .body("{}")
                .when()
                .post("/calm/domains/invalid_domain/user-access")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_400_when_invalid_domain_format_provided_on_get_user_access() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/user-access")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_400_when_invalid_domain_format_provided_on_get_user_access_by_id() {
        given()
                .when()
                .get("/calm/domains/invalid_domain/user-access/1")
                .then()
                .statusCode(400)
                .body(containsString(DOMAIN_MESSAGE));
    }

    @Test
    void return_201_created_with_location_header_when_domain_user_access_is_created() throws Exception {
        UserAccess userAccess = new UserAccess();
        userAccess.setDomain("payments");
        userAccess.setPermission(UserAccess.Permission.write);
        userAccess.setUsername("test_user");
        String requestBody = OBJECT_MAPPER.writeValueAsString(userAccess);

        UserAccess created = new UserAccess();
        created.setDomain("payments");
        created.setPermission(UserAccess.Permission.write);
        created.setUsername("test_user");
        created.setUserAccessId(201);
        when(mockUserAccessStore.createUserAccessForDomain(any(UserAccess.class))).thenReturn(created);

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/calm/domains/payments/user-access")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/domains/payments/user-access/201"));

        verify(mockUserAccessStore, times(1)).createUserAccessForDomain(any(UserAccess.class));
    }

    @Test
    void return_400_when_creating_user_access_with_mismatched_domain() throws Exception {
        UserAccess userAccess = new UserAccess();
        userAccess.setDomain("other");
        userAccess.setPermission(UserAccess.Permission.write);
        userAccess.setUsername("test_user");
        String requestBody = OBJECT_MAPPER.writeValueAsString(userAccess);

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/calm/domains/payments/user-access")
                .then()
                .statusCode(400)
                .body(containsString("Bad Request"));

        verify(mockUserAccessStore, times(0)).createUserAccessForDomain(any(UserAccess.class));
    }

    @Test
    void return_500_when_store_returns_domain_that_causes_uri_syntax_error() throws Exception {
        UserAccess invalid = new UserAccess();
        invalid.setDomain("payments invalid");
        invalid.setUserAccessId(1);
        when(mockUserAccessStore.createUserAccessForDomain(any(UserAccess.class))).thenReturn(invalid);

        UserAccess userAccess = new UserAccess();
        userAccess.setDomain("payments");
        userAccess.setPermission(UserAccess.Permission.write);
        userAccess.setUsername("test_user");

        given()
                .header("Content-Type", "application/json")
                .body(OBJECT_MAPPER.writeValueAsString(userAccess))
                .when()
                .post("/calm/domains/payments/user-access")
                .then()
                .statusCode(500)
                .body(containsString("System Malfunction"));

        verify(mockUserAccessStore, times(1)).createUserAccessForDomain(any(UserAccess.class));
    }

    @Test
    void return_500_when_internal_error_occurs_during_domain_user_access_creation() throws Exception {
        when(mockUserAccessStore.createUserAccessForDomain(any(UserAccess.class)))
                .thenThrow(new RuntimeException("Unexpected error"));

        UserAccess userAccess = new UserAccess();
        userAccess.setDomain("payments");
        userAccess.setPermission(UserAccess.Permission.write);
        userAccess.setUsername("test_user");
        String requestBody = OBJECT_MAPPER.writeValueAsString(userAccess);

        given()
                .header("Content-Type", "application/json")
                .body(requestBody)
                .when()
                .post("/calm/domains/payments/user-access")
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
                .get("/calm/domains/payments/user-access")
                .then()
                .statusCode(200)
                .body(containsString("test_user1"))
                .body(containsString("test_user2"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomain("payments");
    }

    @Test
    void return_404_when_no_user_access_found_for_domain() throws Exception {
        when(mockUserAccessStore.getUserAccessForDomain("payments"))
                .thenThrow(new UserAccessNotFoundException());

        given()
                .when()
                .get("/calm/domains/payments/user-access")
                .then()
                .statusCode(404)
                .body(containsString("No access permissions found"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomain("payments");
    }

    @Test
    void return_500_when_internal_error_occurs_while_getting_domain_user_access() throws Exception {
        when(mockUserAccessStore.getUserAccessForDomain("payments"))
                .thenThrow(new RuntimeException("DB error"));

        given()
                .when()
                .get("/calm/domains/payments/user-access")
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
                .get("/calm/domains/payments/user-access/201")
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
                .get("/calm/domains/payments/user-access/999")
                .then()
                .statusCode(404)
                .body(containsString("No access permissions found"));

        verify(mockUserAccessStore, times(1)).getUserAccessForDomainAndId("payments", 999);
    }
}
