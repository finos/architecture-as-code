package org.finos.calm.store.github.registry;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * An immutable point-in-time view of every {@link RegistryEntry} across every configured
 * namespace, as of the last {@link ResourceRegistry#rebuild}. Immutability matters here more
 * than in most snapshots: {@code rebuild} runs on a scheduler thread while request threads are
 * concurrently reading, and a mutable, partially-rebuilt map would let a request see some
 * entries from the old scan and some from the new one. {@code entriesByNamespace} and
 * {@code entriesByQualifiedId} (keyed {@code "namespace:uniqueId"}) are two indices over the
 * same entries, not two sources of truth - built together, in {@code rebuild}, from a single
 * pass over the clone.
 */
public record RegistrySnapshot(
        Map<String, List<RegistryEntry>> entriesByNamespace,
        Map<String, RegistryEntry> entriesByQualifiedId
) {
    public static final RegistrySnapshot EMPTY = new RegistrySnapshot(
            Collections.emptyMap(), Collections.emptyMap());

    public Optional<RegistryEntry> findByUniqueId(String namespace, String uniqueId) {
        return Optional.ofNullable(entriesByQualifiedId.get(namespace + ":" + uniqueId));
    }

    public List<RegistryEntry> listByType(String namespace, RegistryResourceType type) {
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
