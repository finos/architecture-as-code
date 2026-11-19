package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.finos.calm.domain.exception.InvalidResourceIdException;

/** Maps an unresolvable resource id to a sanitised 400 response. */
@Provider
public class InvalidResourceIdExceptionMapper implements ExceptionMapper<InvalidResourceIdException> {

    @Override
    public Response toResponse(InvalidResourceIdException exception) {
        return CalmResourceErrorResponses.invalidResourceIdResponse(exception.getMessage());
    }
}
