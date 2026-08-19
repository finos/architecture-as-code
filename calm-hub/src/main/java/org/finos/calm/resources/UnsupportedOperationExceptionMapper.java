package org.finos.calm.resources;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.finos.calm.domain.exception.GitHubWriteNotSupportedException;

import java.util.Map;

@Provider
public class UnsupportedOperationExceptionMapper implements ExceptionMapper<GitHubWriteNotSupportedException> {

    @Override
    public Response toResponse(GitHubWriteNotSupportedException e) {
        return Response.status(501)
                .entity(Map.of("error", e.getMessage()))
                .type(MediaType.APPLICATION_JSON)
                .build();
    }
}
