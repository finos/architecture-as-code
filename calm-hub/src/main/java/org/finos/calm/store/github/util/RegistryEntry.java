package org.finos.calm.store.github.util;

import java.nio.file.Path;
import java.time.Instant;

public record RegistryEntry(
        String uniqueId,
        Path filePath,
        CalmResourceType type,
        String name,
        Instant lastModified
) {}
