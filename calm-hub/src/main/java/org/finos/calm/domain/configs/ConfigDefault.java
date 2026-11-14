package org.finos.calm.domain.configs;

import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * The config version that a namespace names as its default for one config type.
 *
 * @param namespace the namespace that sets the default
 */
@RegisterForReflection
public record ConfigDefault(String configType, String namespace, int configId, String version) {
}
