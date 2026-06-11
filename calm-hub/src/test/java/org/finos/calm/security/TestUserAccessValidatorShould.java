package org.finos.calm.security;

import org.finos.calm.domain.UserAccess;
import org.finos.calm.domain.exception.UserAccessNotFoundException;
import org.finos.calm.store.UserAccessStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestUserAccessValidatorShould {

    @Mock
    UserAccessStore mockUserAccessStore;

    UserAccessValidator validator;

    @BeforeEach
    void setUp() {
        validator = new UserAccessValidator(mockUserAccessStore);
    }

    @Test
    void return_namespaces_for_user_with_access_grants() throws UserAccessNotFoundException {
        UserAccess ua1 = new UserAccess("alice", UserAccess.Permission.read, "finos");
        UserAccess ua2 = new UserAccess("alice", UserAccess.Permission.write, "workshop");
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenReturn(List.of(ua1, ua2));

        Set<String> result = validator.getReadableNamespaces("alice");

        assertEquals(Set.of("finos", "workshop"), result);
    }

    @Test
    void return_empty_set_when_user_has_no_access_grants() throws UserAccessNotFoundException {
        when(mockUserAccessStore.getUserAccessForUsername("alice")).thenThrow(new UserAccessNotFoundException());

        Set<String> result = validator.getReadableNamespaces("alice");

        assertTrue(result.isEmpty());
    }
}
