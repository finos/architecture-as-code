package org.finos.calm.resources;

import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.test.InjectMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import jakarta.enterprise.inject.Instance;
import org.finos.calm.domain.exception.NamespaceAlreadyExistsException;
import org.finos.calm.domain.namespaces.NamespaceInfo;
import org.finos.calm.security.CalmHubPermissionChecker;
import org.finos.calm.security.UserAccessValidator;
import org.finos.calm.store.NamespaceStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.Principal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static io.restassured.RestAssured.given;
import static org.finos.calm.resources.ResourceValidationConstants.NAMESPACE_MESSAGE;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.*;

@TestSecurity(authorizationEnabled = false)
@QuarkusTest
@ExtendWith(MockitoExtension.class)
public class TestNamespaceResourceShould {

    @InjectMock
    NamespaceStore namespaceStore;

    // Plain Mockito mocks for direct-instantiation filtering tests
    @Mock
    private NamespaceStore mockNamespaceStore;
    @Mock
    private Instance<UserAccessValidator> mockValidatorInstance;
    @Mock
    private UserAccessValidator mockValidator;
    @Mock
    private SecurityIdentity mockIdentity;
    @Mock
    private Principal mockPrincipal;
    @Mock
    private CalmHubPermissionChecker mockPermissionChecker;

    private static final List<NamespaceInfo> ALL_NAMESPACES = List.of(
            new NamespaceInfo("finos", "FINOS namespace"),
            new NamespaceInfo("custom", "custom namespace")
    );

    private NamespaceResource resourceWithAuth(boolean authEnabled) {
        NamespaceResource resource = new NamespaceResource(mockNamespaceStore, mockValidatorInstance, mockPermissionChecker);
        resource.identity = mockIdentity;
        resource.authEnabled = authEnabled;
        return resource;
    }

    @Test
    void return_empty_wrapper_when_no_namespaces_in_store() {
        when(namespaceStore.getNamespaces()).thenReturn(new ArrayList<>());

        given()
                .when()
                .get("/calm/namespaces")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[]}"));

        verify(namespaceStore, times(1)).getNamespaces();
    }

    @Test
    void return_namespaces_when_namespaces_in_store() {
        when(namespaceStore.getNamespaces()).thenReturn(Arrays.asList(
                new NamespaceInfo("finos","FINOS namespace"),
                new NamespaceInfo("custom","custom ns")
        ));

        given()
                .when()
                .get("/calm/namespaces")
                .then()
                .statusCode(200)
                .body(equalTo("{\"values\":[{\"name\":\"finos\",\"description\":\"FINOS namespace\"},{\"name\":\"custom\",\"description\":\"custom ns\"}]}"));

        verify(namespaceStore, times(1)).getNamespaces();
    }

    @Test
    void create_namespace_successfully() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"test-namespace\",\"description\":\"desc\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/test-namespace"));

        verify(namespaceStore).createNamespace("test-namespace","desc");
    }

    @Test
    void return_400_when_namespace_is_null() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{}") 
                .when()
                .post("/calm/namespaces")
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
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Name must not be blank"));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_contains_invalid_characters() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"test@namespace\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_201_when_dotted_namespace_is_valid() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"org.finos\",\"description\":\"FINOS org namespace\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(201)
                .header("Location", containsString("/calm/namespaces/org.finos"));

        verify(namespaceStore).createNamespace("org.finos", "FINOS org namespace");
    }

    @Test
    void return_400_when_namespace_has_trailing_dot() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"org.finos.\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_has_leading_dot() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\".org.finos\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_has_consecutive_dots() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"org..finos\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString(NAMESPACE_MESSAGE));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_is_the_reserved_GLOBAL_name() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"GLOBAL\",\"description\":\"desc\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("reserved"));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_400_when_namespace_is_reserved_GLOBAL_name_case_insensitive() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .body("{\"name\":\"global\",\"description\":\"desc\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("reserved"));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_409_when_namespace_already_exists() throws NamespaceAlreadyExistsException {
        doThrow(new NamespaceAlreadyExistsException("Namespace already exists: existing-namespace"))
                .when(namespaceStore).createNamespace("existing-namespace", "desc");

        given()
                .contentType("application/json")
                .body("{\"name\":\"existing-namespace\",\"description\":\"desc\"}")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(409)
                .body(containsString("Namespace already exists"));

        verify(namespaceStore).createNamespace("existing-namespace", "desc");
    }

    @Test
    void return_400_when_request_body_is_null() throws NamespaceAlreadyExistsException {
        given()
                .contentType("application/json")
                .when()
                .post("/calm/namespaces")
                .then()
                .statusCode(400)
                .body(containsString("Request must not be null"));

        verify(namespaceStore, never()).createNamespace(any(), any());
    }

    @Test
    void return_all_namespaces_when_auth_disabled() {
        when(mockNamespaceStore.getNamespaces()).thenReturn(ALL_NAMESPACES);

        assertEquals(ALL_NAMESPACES, resourceWithAuth(false).namespaces().getValues());
    }

    @Test
    void return_all_namespaces_when_validator_not_resolvable() {
        when(mockValidatorInstance.isResolvable()).thenReturn(false);
        when(mockNamespaceStore.getNamespaces()).thenReturn(ALL_NAMESPACES);

        assertEquals(ALL_NAMESPACES, resourceWithAuth(true).namespaces().getValues());
    }

    @Test
    void return_all_namespaces_for_global_admin() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockPermissionChecker.hasGlobalAdmin(mockIdentity)).thenReturn(true);
        when(mockNamespaceStore.getNamespaces()).thenReturn(ALL_NAMESPACES);

        assertEquals(ALL_NAMESPACES, resourceWithAuth(true).namespaces().getValues());
    }

    @Test
    void return_only_accessible_namespaces_for_authenticated_user() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockPermissionChecker.hasGlobalAdmin(mockIdentity)).thenReturn(false);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("thomas");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("thomas")).thenReturn(Set.of("finos"));
        when(mockNamespaceStore.getNamespaces()).thenReturn(ALL_NAMESPACES);

        assertEquals(List.of(new NamespaceInfo("finos", "FINOS namespace")),
                resourceWithAuth(true).namespaces().getValues());
    }

    @Test
    void return_empty_list_when_user_has_no_grants() {
        when(mockValidatorInstance.isResolvable()).thenReturn(true);
        when(mockPermissionChecker.hasGlobalAdmin(mockIdentity)).thenReturn(false);
        when(mockIdentity.getPrincipal()).thenReturn(mockPrincipal);
        when(mockPrincipal.getName()).thenReturn("thomas");
        when(mockValidatorInstance.get()).thenReturn(mockValidator);
        when(mockValidator.getReadableNamespaces("thomas")).thenReturn(Set.of());
        when(mockNamespaceStore.getNamespaces()).thenReturn(ALL_NAMESPACES);

        assertTrue(resourceWithAuth(true).namespaces().getValues().isEmpty());
    }
}
