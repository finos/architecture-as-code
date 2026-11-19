package org.finos.calm.resources.params;

import jakarta.ws.rs.PathParam;
import jakarta.validation.constraints.Pattern;

import static org.finos.calm.resources.ResourceValidationConstants.QUERY_PARAM_NO_WHITESPACE_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.QUERY_PARAM_NO_WHITESPACE_REGEX;

/** Storage-route id for a flow, bound from {flowId}. */
public class FlowIdParam extends ResourceIdParam {

    @PathParam("flowId")
    @Pattern(regexp = QUERY_PARAM_NO_WHITESPACE_REGEX, message = QUERY_PARAM_NO_WHITESPACE_MESSAGE)
    private String flowId;

    @Override
    public String rawId() {
        return flowId;
    }
}
