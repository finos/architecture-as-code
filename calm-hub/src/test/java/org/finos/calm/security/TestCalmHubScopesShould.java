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
        assertTrue(actual.getCause() instanceof UnsupportedOperationException);
    }

    @Test
    void match_architectures_read_constant() {
        assertEquals("architectures:read", CalmHubScopes.ARCHITECTURES_READ);
    }

    @Test
    void match_architectures_all_constant() {
        assertEquals("architectures:all", CalmHubScopes.ARCHITECTURES_ALL);
    }

    @Test
    void match_adrs_all_constant() {
        assertEquals("adrs:all", CalmHubScopes.ADRS_ALL);
    }

    @Test
    void match_adrs_read_constant() {
        assertEquals("adrs:read", CalmHubScopes.ADRS_READ);
    }
}
