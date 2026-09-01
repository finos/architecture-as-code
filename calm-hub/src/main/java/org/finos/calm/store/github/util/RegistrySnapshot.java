package org.finos.calm.store.github.util;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public record RegistrySnapshot(
        Map<String, List<RegistryEntry>> entriesByNamespace,
        Map<String, RegistryEntry> entriesByQualifiedId,
        Map<CalmResourceType, List<RegistryEntry>> entriesByType
) {
    public static final RegistrySnapshot EMPTY = new RegistrySnapshot(
            Collections.emptyMap(), Collections.emptyMap(), Collections.emptyMap());

    public Optional<RegistryEntry> findByUniqueId(String namespace, String uniqueId) {
        return Optional.ofNullable(entriesByQualifiedId.get(namespace + ":" + uniqueId));
    }

    public List<RegistryEntry> listByType(String namespace, CalmResourceType type) {
        return entriesByNamespace.getOrDefault(namespace, Collections.emptyList())
                .stream()
                .filter(e -> e.type() == type)
                .toList();
    }

    public List<RegistryEntry> listAll(String namespace) {
        return entriesByNamespace.getOrDefault(namespace, Collections.emptyList());
    }

    public List<String> getNamespaces() {
        return List.copyOf(entriesByNamespace.keySet());
    }
}
