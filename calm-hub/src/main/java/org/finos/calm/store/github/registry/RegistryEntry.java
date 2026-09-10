package org.finos.calm.store.github.registry;

import java.nio.file.Path;
import java.time.Instant;

public record RegistryEntry(
        String uniqueId,
        Path filePath,
        RegistryResourceType type,
        String name,
        Instant lastModified
) {}
