package org.finos.calm.domain.configs;

import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public record SetConfigDefaultRequest(Integer configId, String version) {
}
