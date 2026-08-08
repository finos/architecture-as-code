package org.finos.calm.store;

import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TestNamespaceStoreShould {

    private static final String NAMESPACE = "finos";

    @Mock(answer = CALLS_REAL_METHODS)
    private NamespaceStore namespaceStore;

    @Test
    void not_throw_when_namespace_exists() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(true);

        assertDoesNotThrow(() -> namespaceStore.requireNamespace(NAMESPACE));
    }

    @Test
    void throw_a_namespace_not_found_exception_when_namespace_does_not_exist() {
        when(namespaceStore.namespaceExists(NAMESPACE)).thenReturn(false);

        assertThrows(NamespaceNotFoundException.class, () -> namespaceStore.requireNamespace(NAMESPACE));
    }
}
