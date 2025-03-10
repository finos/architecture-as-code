package org.finos.calm.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class TestCalmHubScopesShould {

    @Test
    void prevent_instantiation() {
        assertThrows(UnsupportedOperationException.class, () -> {
            throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
        });
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
