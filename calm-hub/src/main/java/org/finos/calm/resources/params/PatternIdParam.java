package org.finos.calm.resources.params;

import jakarta.ws.rs.PathParam;
import jakarta.validation.constraints.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.QUERY_PARAM_NO_WHITESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.QUERY_PARAM_NO_WHITESPACE_REGEX;

/** Storage-route id for a pattern, bound from {patternId}. */
public class PatternIdParam extends ResourceIdParam {

    @PathParam("patternId")
    @Pattern(regexp = QUERY_PARAM_NO_WHITESPACE_REGEX, message = QUERY_PARAM_NO_WHITESPACE_MESSAGE)
    private String patternId;

    @Override
    public String rawId() {
        return patternId;
    }
}
