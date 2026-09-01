package org.finos.calm.resources;

import org.finos.calm.domain.ResourceType;
import org.finos.calm.domain.exception.NamespaceNotFoundException;
import org.finos.calm.store.ResourceMappingStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TestMappingCleanupShould {

    @Mock
    private ResourceMappingStore mappingStore;

    @Mock
    private Logger logger;

    @Test
    void delete_the_mapping_by_numeric_id() throws NamespaceNotFoundException {
        MappingCleanup.deleteMapping(mappingStore, logger, "finos", ResourceType.ARCHITECTURE, 42);

        verify(mappingStore).deleteMappingByNumericId("finos", ResourceType.ARCHITECTURE, 42);
    }

    @Test
    void log_rather_than_throw_when_the_namespace_has_vanished_mid_request() throws NamespaceNotFoundException {
        // The resource is already deleted by the time this runs, so a failure to clean up its
        // mapping must not fail the delete response over cleanup that can't be undone anyway.
        doThrow(new NamespaceNotFoundException())
                .when(mappingStore).deleteMappingByNumericId("finos", ResourceType.ARCHITECTURE, 42);

        assertDoesNotThrow(() ->
                MappingCleanup.deleteMapping(mappingStore, logger, "finos", ResourceType.ARCHITECTURE, 42));

        verify(mappingStore).deleteMappingByNumericId("finos", ResourceType.ARCHITECTURE, 42);
    }

    @Test
    void log_rather_than_throw_when_the_mapping_store_fails_at_runtime() throws NamespaceNotFoundException {
        // A driver/DB failure (MongoException, a Nitrite lock/store error, ...) must not
        // surface as an unhandled 500 for a delete that has already succeeded.
        doThrow(new RuntimeException("connection reset"))
                .when(mappingStore).deleteMappingByNumericId("finos", ResourceType.ARCHITECTURE, 42);

        assertDoesNotThrow(() ->
                MappingCleanup.deleteMapping(mappingStore, logger, "finos", ResourceType.ARCHITECTURE, 42));

        verify(mappingStore).deleteMappingByNumericId("finos", ResourceType.ARCHITECTURE, 42);
    }
}
