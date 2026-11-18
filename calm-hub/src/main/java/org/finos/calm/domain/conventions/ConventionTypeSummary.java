package org.finos.calm.domain.conventions;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record ConventionTypeSummary(String type, String schema) {
}
