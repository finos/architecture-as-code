package org.finos.calm.store.github.registry;

import java.nio.file.Path;
import java.time.Instant;

/**
 * One CALM resource classified out of a namespace's clone: a {@code filePath} relative to the
 * clone root, the {@link RegistryResourceType} {@link CalmContentDetector} assigned it, and
 * the display {@code name} and {@code uniqueId} every store's numeric id is derived from
 * (via {@code uniqueId().hashCode() & 0x7FFFFFFF}). Produced only by
 * {@link ResourceRegistry#rebuild}, held only inside a {@link RegistrySnapshot} - a store never
 * constructs one directly, only reads entries back out of the snapshot it was given.
 */
public record RegistryEntry(
        String uniqueId,
        Path filePath,
        RegistryResourceType type,
        String name,
        Instant lastModified
) {}
