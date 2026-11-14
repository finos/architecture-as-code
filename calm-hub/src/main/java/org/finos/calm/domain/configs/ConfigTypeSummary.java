package org.finos.calm.domain.configs;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record ConfigTypeSummary(String type, String schema) {
}
