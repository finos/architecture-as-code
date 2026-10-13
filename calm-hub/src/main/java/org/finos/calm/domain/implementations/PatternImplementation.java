package org.finos.calm.domain.implementations;

import io.quarkus.runtime.annotations.RegisterForReflection;

import java.util.Objects;

/**
 * One architecture version whose {@code $schema} names the pattern that was asked about.
 *
 * <p>{@code customId} is the name the architecture is addressed by on the name-based API, and is
 * null for an architecture written through the numeric API, which never had one.</p>
 */
@RegisterForReflection
public class PatternImplementation {

    private final String namespace;
    private final int architectureId;
    private final String version;
    private final String customId;

    public PatternImplementation(String namespace, int architectureId, String version, String customId) {
        this.namespace = namespace;
        this.architectureId = architectureId;
        this.version = version;
        this.customId = customId;
    }

    public String getNamespace() {
        return namespace;
    }

    public int getArchitectureId() {
        return architectureId;
    }

    public String getVersion() {
        return version;
    }

    public String getCustomId() {
        return customId;
    }

    public PatternImplementation withCustomId(String resolvedCustomId) {
        return new PatternImplementation(namespace, architectureId, version, resolvedCustomId);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PatternImplementation other)) {
            return false;
        }
        return architectureId == other.architectureId
                && Objects.equals(namespace, other.namespace)
                && Objects.equals(version, other.version)
                && Objects.equals(customId, other.customId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(namespace, architectureId, version, customId);
    }

    @Override
    public String toString() {
        return "PatternImplementation{namespace='" + namespace + "', architectureId=" + architectureId
                + ", version='" + version + "', customId='" + customId + "'}";
    }
}
