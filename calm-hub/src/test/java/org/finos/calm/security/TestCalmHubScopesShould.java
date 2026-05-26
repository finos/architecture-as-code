package org.finos.calm.security;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;

import static org.junit.jupiter.api.Assertions.*;

public class TestCalmHubScopesShould {

    @Test
    void prevent_instantiation() throws Exception {
        Constructor<CalmHubScopes> constructor = CalmHubScopes.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        Exception actual = assertThrows(InvocationTargetException.class, constructor::newInstance);
        assertInstanceOf(UnsupportedOperationException.class, actual.getCause());
    }

    @Test
    void match_read_constant() {
        assertEquals("read", CalmHubScopes.READ);
    }

    @Test
    void match_write_constant() {
        assertEquals("write", CalmHubScopes.WRITE);
    }

    @Test
    void match_admin_constant() {
        assertEquals("admin", CalmHubScopes.ADMIN);
    }

    @Test
    void match_global_admin_constant() {
        assertEquals("global_admin", CalmHubScopes.GLOBAL_ADMIN);
    }
}
