package org.finos.calm.resources;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.finos.calm.domain.exception.StorageWriteException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Maps {@link StorageWriteException} to an honest HTTP response instead of letting a write
 * failure surface as a misleading not-found error or an undiagnostic generic 500. The full
 * cause is logged server-side only, never echoed to the client.
 *
 * <p>{@code @ApplicationScoped} makes this injectable directly (e.g. by {@link AdrResource},
 * whose per-endpoint blanket exception catch would otherwise shadow this mapper), so the
 * 413/500 mapping logic has a single definition instead of being duplicated.
 */
@ApplicationScoped
@Provider
public class StorageWriteExceptionMapper implements ExceptionMapper<StorageWriteException> {

    private static final Logger LOG = LoggerFactory.getLogger(StorageWriteExceptionMapper.class);

    @Override
    public Response toResponse(StorageWriteException e) {
        // The store layer already logs the underlying cause with its stack trace, so only a
        // concise summary is logged here to avoid doubling it for every failure.
        LOG.error("Storage write failed: {}", e.getMessage());
        if (e.isCapacityExceeded()) {
            return Response.status(Response.Status.REQUEST_ENTITY_TOO_LARGE)
                    .entity("This resource has reached the maximum storage size and cannot accept further versions")
                    .build();
        }
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity("The write could not be completed due to a storage error")
                .build();
    }
}
