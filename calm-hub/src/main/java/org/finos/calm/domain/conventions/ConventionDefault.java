package org.finos.calm.domain.conventions;

import io.quarkus.runtime.annotations.RegisterForReflection;

/**
 * The convention version that a namespace names as its default for one convention type.
 *
 * @param namespace the namespace that sets the default
 */
@RegisterForReflection
public record ConventionDefault(String conventionType, String namespace, int conventionId, String version) {
}
