package org.finos.calm.store;

/** One stored architecture version and the {@code $schema} its content declares. */
public record ArchitectureSchema(String namespace, int architectureId, String version, String schema) {
}
