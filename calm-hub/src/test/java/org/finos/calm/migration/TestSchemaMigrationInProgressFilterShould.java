package org.finos.calm.migration;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.finos.calm.store.SchemaVersionStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@MockitoSettings(strictness = Strictness.LENIENT)
@ExtendWith(MockitoExtension.class)
class TestSchemaMigrationInProgressFilterShould {

    @Mock
    SchemaVersionStore schemaVersionStore;

    @Mock
    ContainerRequestContext requestContext;

    @Mock
    UriInfo uriInfo;

    private SchemaMigrationInProgressFilter filter;

    @BeforeEach
    void setup() {
        filter = new SchemaMigrationInProgressFilter(schemaVersionStore);
        when(requestContext.getUriInfo()).thenReturn(uriInfo);
        when(uriInfo.getPath()).thenReturn("calm/namespaces");
        when(requestContext.getMethod()).thenReturn("GET");
    }

    @Test
    void reject_the_request_with_503_when_the_migration_lock_is_held() {
        when(schemaVersionStore.isMigrationLockHeld()).thenReturn(true);

        filter.filter(requestContext);

        ArgumentCaptor<Response> captor = ArgumentCaptor.forClass(Response.class);
        verify(requestContext).abortWith(captor.capture());
        assertEquals(503, captor.getValue().getStatus());
    }

    @Test
    void allow_the_request_when_the_migration_lock_is_not_held() {
        when(schemaVersionStore.isMigrationLockHeld()).thenReturn(false);

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @Test
    void not_recheck_the_store_for_a_second_request_within_the_cache_ttl() {
        AtomicLong now = new AtomicLong(1_000_000L);
        SchemaMigrationInProgressFilter cachingFilter = new SchemaMigrationInProgressFilter(schemaVersionStore, now::get);
        when(schemaVersionStore.isMigrationLockHeld()).thenReturn(true);

        cachingFilter.filter(requestContext);
        now.addAndGet(SchemaMigrationInProgressFilter.CACHE_TTL.toNanos() - 1);
        cachingFilter.filter(requestContext);

        verify(schemaVersionStore, times(1)).isMigrationLockHeld();
    }

    @Test
    void recheck_the_store_once_the_cache_ttl_has_elapsed() {
        AtomicLong now = new AtomicLong(1_000_000L);
        SchemaMigrationInProgressFilter cachingFilter = new SchemaMigrationInProgressFilter(schemaVersionStore, now::get);
        when(schemaVersionStore.isMigrationLockHeld()).thenReturn(false);

        cachingFilter.filter(requestContext);
        now.addAndGet(SchemaMigrationInProgressFilter.CACHE_TTL.toNanos() + 1);
        cachingFilter.filter(requestContext);

        verify(schemaVersionStore, times(2)).isMigrationLockHeld();
    }

    @Test
    void keep_serving_a_stale_cached_result_until_the_ttl_elapses_even_if_the_store_changes() {
        AtomicLong now = new AtomicLong(1_000_000L);
        SchemaMigrationInProgressFilter cachingFilter = new SchemaMigrationInProgressFilter(schemaVersionStore, now::get);
        when(schemaVersionStore.isMigrationLockHeld()).thenReturn(false);
        cachingFilter.filter(requestContext);

        when(schemaVersionStore.isMigrationLockHeld()).thenReturn(true);
        now.addAndGet(SchemaMigrationInProgressFilter.CACHE_TTL.toNanos() - 1);
        cachingFilter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @Test
    void allow_the_request_when_the_store_fails_instead_of_letting_the_exception_escape() {
        when(schemaVersionStore.isMigrationLockHeld()).thenThrow(new RuntimeException("Mongo unavailable"));

        filter.filter(requestContext);

        verify(requestContext, never()).abortWith(any());
    }

    @Test
    void not_cache_a_store_failure_so_the_next_request_retries() {
        AtomicLong now = new AtomicLong(1_000_000L);
        SchemaMigrationInProgressFilter cachingFilter = new SchemaMigrationInProgressFilter(schemaVersionStore, now::get);
        when(schemaVersionStore.isMigrationLockHeld())
                .thenThrow(new RuntimeException("Mongo unavailable"))
                .thenReturn(true);

        cachingFilter.filter(requestContext);
        now.addAndGet(1);
        cachingFilter.filter(requestContext);

        verify(schemaVersionStore, times(2)).isMigrationLockHeld();
    }
}
