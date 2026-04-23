package org.finos.calm.security;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.UserAccess.Permission;
import org.finos.calm.domain.UserAccess.ResourceType;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TestUserAccessValidatorShould {

    private UserAccessStore userAccessStore;
    private UserAccessValidator validator;

    @BeforeEach
    void setUp() {
        userAccessStore = mock(UserAccessStore.class);
        validator = new UserAccessValidator(userAccessStore);
    }

    @Test
    void return_true_when_user_has_sufficient_permissions() throws Exception {
        UserRequestAttributes requestAttributes = new UserRequestAttributes("GET", "testuser",
                "/calm/namespace/finos/patterns", "finos");
        UserAccess userAccess = new UserAccess("testuser", Permission.read, "finos", ResourceType.patterns);
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenReturn(List.of(userAccess));

        boolean actual = validator.isUserAuthorized(requestAttributes);
        assertTrue(actual);
    }

    @Test
    void return_false_when_user_has_no_matching_permission() throws Exception {
        UserRequestAttributes requestAttributes = new UserRequestAttributes("GET", "testuser",
                "/calm/namespace/finos/patterns", "finos");
        UserAccess userAccess = new UserAccess("testuser", Permission.read, "workshop", ResourceType.patterns);
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenReturn(List.of(userAccess));

        boolean actual = validator.isUserAuthorized(requestAttributes);
        assertFalse(actual);
    }

    @Test
    void return_true_when_user_has_write_permission() throws Exception {
        UserRequestAttributes requestAttributes = new UserRequestAttributes("GET", "testuser",
                "/calm/namespace/finos/patterns", "finos");
        UserAccess userAccess = new UserAccess("testuser", Permission.write, "finos", ResourceType.patterns);
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenReturn(List.of(userAccess));

        boolean actual = validator.isUserAuthorized(requestAttributes);
        assertTrue(actual);
    }

    @Test
    void return_true_when_user_accessing_default_get_namespaces_endpoint() throws Exception {
        UserRequestAttributes requestAttributes = new UserRequestAttributes("GET", "testuser",
                "/calm/namespaces", null);

        boolean actual = validator.isUserAuthorized(requestAttributes);
        assertTrue(actual);
    }

    @Test
    void return_false_when_no_permissions_are_mapped_to_user() throws Exception {
        UserRequestAttributes requestAttributes = new UserRequestAttributes("GET", "testuser",
                "/calm/namespaces/test/finos", "finos");
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenThrow(new UserAccessNotFoundException());

        boolean actual = validator.isUserAuthorized(requestAttributes);
        assertFalse(actual);
    }

    @Test
    void return_true_when_user_accessing_search_endpoint() throws Exception {
        UserRequestAttributes requestAttributes = new UserRequestAttributes("GET", "testuser",
                "/calm/search", null);

        boolean actual = validator.isUserAuthorized(requestAttributes);
        assertTrue(actual);
    }

    @Test
    void return_readable_namespaces_for_user_with_grants() throws Exception {
        UserAccess grant1 = new UserAccess("testuser", Permission.read, "finos", ResourceType.patterns);
        UserAccess grant2 = new UserAccess("testuser", Permission.write, "workshop", ResourceType.architectures);
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenReturn(List.of(grant1, grant2));

        Set<String> namespaces = validator.getReadableNamespaces("testuser");
        assertEquals(Set.of("finos", "workshop"), namespaces);
    }

    @Test
    void return_empty_set_when_user_has_no_grants() throws Exception {
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenThrow(new UserAccessNotFoundException());

        Set<String> namespaces = validator.getReadableNamespaces("testuser");
        assertTrue(namespaces.isEmpty());
    }

    @Test
    void return_deduplicated_namespaces_when_user_has_multiple_grants_for_same_namespace() throws Exception {
        UserAccess grant1 = new UserAccess("testuser", Permission.read, "finos", ResourceType.patterns);
        UserAccess grant2 = new UserAccess("testuser", Permission.write, "finos", ResourceType.architectures);
        when(userAccessStore.getUserAccessForUsername("testuser"))
                .thenReturn(List.of(grant1, grant2));

        Set<String> namespaces = validator.getReadableNamespaces("testuser");
        assertEquals(Set.of("finos"), namespaces);
    }
}
