package org.finos.calm.resources;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.finos.calm.domain.exception.AmbiguousResourceIdException;

/** Maps an ambiguous resource id to a generic 404; candidate paths stay in the log only. */
@Provider
public class AmbiguousResourceIdExceptionMapper implements ExceptionMapper<AmbiguousResourceIdException> {

    @Override
    public Response toResponse(AmbiguousResourceIdException exception) {
        return CalmResourceErrorResponses.ambiguousResourceIdResponse();
    }
}
