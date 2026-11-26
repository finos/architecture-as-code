package org.finos.calm.resources.params;

import jakarta.ws.rs.QueryParam;
import jakarta.validation.constraints.Pattern;
import org.finos.calm.domain.ResourceId;
import org.finos.calm.services.ResourceIdResolver;

import static org.finos.calm.resources.ResourceValidationConstants.PATH_QUERY_PARAM_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.PATH_QUERY_PARAM_REGEX;
import static org.finos.calm.resources.ResourceValidationConstants.VARIANT_QUERY_PARAM_MESSAGE;
import static org.finos.calm.resources.ResourceValidationConstants.VARIANT_QUERY_PARAM_REGEX;

/**
 * Common shape of a storage-route id bean. Subclasses bind one named path parameter; the optional
 * {@code path} and {@code variant} query parameters are carried on every surface so a GitHub id
 * can disambiguate resources that share a stem.
 */
public abstract class ResourceIdParam {

    @QueryParam("path")
    @Pattern(regexp = PATH_QUERY_PARAM_REGEX, message = PATH_QUERY_PARAM_MESSAGE)
    private String path;

    @QueryParam("variant")
    @Pattern(regexp = VARIANT_QUERY_PARAM_REGEX, message = VARIANT_QUERY_PARAM_MESSAGE)
    private String variant;

    public abstract String rawId();

    public String getPath() {
        return path;
    }

    public String getVariant() {
        return variant;
    }

    public ResourceId toResourceId(ResourceIdResolver resolver) {
        return resolver.forStorage(rawId(), path, variant);
    }
}
