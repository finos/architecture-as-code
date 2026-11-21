package org.finos.calm.store.github.registry;

import java.nio.file.Path;
import java.time.Instant;

/**
 * One CALM resource classified out of a namespace's clone: a {@code filePath} relative to the
 * clone root, the {@link RegistryResourceType} {@link CalmContentDetector} assigned it, and the
 * display {@code name} and {@code uniqueId} used by listings and mappings. Identity for direct
 * lookups is the filename stem plus optional path and variant, derived from {@code filePath} via
 * {@link ResourcePathHelper}; the document's {@code unique-id} is no longer part of that identity.
 * Produced only by {@link ResourceRegistry#rebuild}, held only inside a {@link RegistrySnapshot}.
 */
public record RegistryEntry(
        String uniqueId,
        Path filePath,
        RegistryResourceType type,
        String name,
        Instant lastModified
) {
    public String stem() {
        return ResourcePathHelper.stem(filePath);
    }

    public String path() {
        return ResourcePathHelper.path(filePath);
    }

    public String variant() {
        return ResourcePathHelper.variant(filePath);
    }
}
