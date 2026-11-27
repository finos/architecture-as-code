package org.finos.calm.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * Optional grouping metadata carried alongside a string resource ID in GitHub mode.
 *
 * <p>Both fields are omitted from JSON when absent; {@link #of} returns {@code null} when neither
 * is supplied so parent DTOs can omit the whole {@code tags} property.</p>
 */
@RegisterForReflection
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Tags(String path, String variant) {

    public static Tags of(String path, String variant) {
        boolean hasPath = path != null && !path.isBlank();
        boolean hasVariant = variant != null && !variant.isBlank();
        return hasPath || hasVariant ? new Tags(hasPath ? path : null, hasVariant ? variant : null) : null;
    }
}
