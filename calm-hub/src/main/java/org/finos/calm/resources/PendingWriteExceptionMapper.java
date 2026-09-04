package org.finos.calm.resources;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.finos.calm.domain.exception.PendingWriteException;

import java.util.Map;

/**
 * Maps PendingWriteException to 202 Accepted with PR details.
 * This is thrown by GitHub stores when a write successfully creates a PR —
 * it's not an error, it's the expected outcome in fork-based write mode.
 */
@Provider
public class PendingWriteExceptionMapper implements ExceptionMapper<PendingWriteException> {

    @Override
    public Response toResponse(PendingWriteException e) {
        return Response.accepted(Map.of(
                "status", "pending",
                "pullRequestUrl", e.getPullRequestUrl(),
                "pullRequestNumber", e.getPullRequestNumber(),
                "message", e.getMessage()
        )).type(MediaType.APPLICATION_JSON).build();
    }
}
