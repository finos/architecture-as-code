package org.finos.calm.resources;

import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.exception.NamespaceParentNotFoundException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.services.NamespaceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.Arrays;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestNamespaceResourceShould {

    @InjectMock
    NamespaceService namespaceService;

    @InjectMock
    CalmHubPermissionChecker mockPermissionChecker;

    @BeforeEach
    void setUpPermissions() {
        lenient().when(mockPermissionChecker.hasGlobalAdmin(any())).thenReturn(true);
        lenient().when(mockPermissionChecker.allowNamespaceAdmin(any(), any())).thenReturn(false);
    }

    @Test
    void return_empty_wrapper_when_no_namespaces_in_store() {
        when(namespaceService.getNamespaces()).thenReturn(new ArrayList<>());

        given()
                .when()
                .get("/api/calm/namespaces")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(namespaceService, times(1)).getNamespaces();
    }

    @Test
    void return_namespaces_when_namespaces_in_store() {
        when(namespaceService.getNamespaces()).thenReturn(Arrays.asList(
                new NamespaceInfo("finos","FINOS namespace"),
                new NamespaceInfo("custom","custom ns")
        ));

        given()
                .when()
                .get("/api/calm/namespaces")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[{\"name\":\"finos\",\"description\":\"FINOS namespace\"},{\"name\":\"custom\",\"description\":\"custom ns\"}]}"));

        verify(namespaceService, times(1)).getNamespaces();
    }

    @Test
    void create_namespace_successfully() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"test-namespace\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/test-namespace"));

        verify(namespaceService).createNamespace("test-namespace", "desc");
    }

    @Test
    void return_400_when_namespace_is_null() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{}") 
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Name must not be null"));

    }

    @Test
    void return_400_when_namespace_is_empty() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Name must not be blank"));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_contains_invalid_characters() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"test@namespace\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_201_when_dotted_namespace_is_valid() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"org.finos\",\"description\":\"FINOS org namespace\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/org.finos"));

        verify(namespaceService).createNamespace("org.finos", "FINOS org namespace");
    }

    @Test
    void return_400_when_namespace_has_trailing_dot() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"org.finos.\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_has_leading_dot() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\".org.finos\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_has_consecutive_dots() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"org..finos\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_is_the_reserved_GLOBAL_name() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"GLOBAL\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("reserved"));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_is_reserved_GLOBAL_name_case_insensitive() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"global\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("reserved"));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_409_when_namespace_already_exists() throws NamespaceAlreadyExistsException {
        doThrow(new NamespaceAlreadyExistsException("Namespace already exists: existing-namespace"))
                .when(namespaceService).createNamespace("existing-namespace", "desc");

        given()
                .contentType("application/json")
                .body("{\"name\":\"existing-namespace\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(409)
                .body(containsString("Namespace already exists"));

        verify(namespaceService).createNamespace("existing-namespace", "desc");
    }

    @Test
    void return_400_when_request_body_is_null() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Request must not be null"));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_403_when_non_admin_creates_top_level_namespace() throws NamespaceAlreadyExistsException {
        when(mockPermissionChecker.hasGlobalAdmin(any())).thenReturn(false);

        given()
                .contentType("application/json")
                .body("{\"name\":\"newteam\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(403)
                .body(containsString("Insufficient permissions"));

        verify(namespaceService, never()).createNamespace(any(), any());
    }

    @Test
    void return_201_when_namespace_admin_creates_child_namespace() throws NamespaceAlreadyExistsException {
        when(mockPermissionChecker.hasGlobalAdmin(any())).thenReturn(false);
        when(mockPermissionChecker.allowNamespaceAdmin(any(), eq("org"))).thenReturn(true);

        given()
                .contentType("application/json")
                .body("{\"name\":\"org.finos\",\"description\":\"FINOS sub-namespace\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/api/calm/namespaces/org.finos"));

        verify(namespaceService).createNamespace("org.finos", "FINOS sub-namespace");
    }

    @Test
    void return_422_when_direct_parent_namespace_does_not_exist() throws Exception {
        doThrow(new NamespaceParentNotFoundException("org.ecosystem.a"))
                .when(namespaceService).createNamespace("org.ecosystem.a.b", "desc");

        given()
                .contentType("application/json")
                .body("{\"name\":\"org.ecosystem.a.b\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(422)
                .body(containsString("org.ecosystem.a"));

        verify(namespaceService).createNamespace("org.ecosystem.a.b", "desc");
    }

    @Test
    void return_403_when_non_admin_creates_child_namespace_without_parent_admin() throws NamespaceAlreadyExistsException {
        when(mockPermissionChecker.hasGlobalAdmin(any())).thenReturn(false);
        when(mockPermissionChecker.allowNamespaceAdmin(any(), eq("org"))).thenReturn(false);

        given()
                .contentType("application/json")
                .body("{\"name\":\"org.finos\",\"description\":\"desc\"}")
                .when()
                .post("/api/calm/namespaces")
                .then()
                .statusCode(403)
                .body(containsString("Insufficient permissions"));

        verify(namespaceService, never()).createNamespace(any(), any());
    }
}
