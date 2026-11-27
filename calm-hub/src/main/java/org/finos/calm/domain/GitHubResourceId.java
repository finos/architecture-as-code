package org.finos.calm.domain;

/**
 * A resource identifier for GitHub storage: the filename stem plus optional path and variant.
 *
 * <p>{@code path} is the slash-joined parent folders relative to the clone root, with the first
 * known type folder removed. {@code variant} is the token from a compound extension. Either may
 * be {@code null} to mean "not supplied", which turns the registry lookup into a partial match.</p>
 */
public record GitHubResourceId(String name, String path, String variant) implements ResourceId {

    public boolean hasPath() {
        return path != null && !path.isBlank();
    }

    public boolean hasVariant() {
        return variant != null && !variant.isBlank();
    }
}
