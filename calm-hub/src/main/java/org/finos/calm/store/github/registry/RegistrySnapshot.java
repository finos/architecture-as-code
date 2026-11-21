package org.finos.calm.store.github.registry;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * An immutable point-in-time view of every {@link RegistryEntry} across every configured
 * namespace, as of the last {@link ResourceRegistry#rebuild}. Immutability matters here more
 * than in most snapshots: {@code rebuild} runs on a scheduler thread while request threads are
 * concurrently reading, and a mutable, partially-rebuilt map would let a request see some
 * entries from the old scan and some from the new one. Direct lookups go through
 * {@link #find}, which returns every match so callers can fail closed on ambiguity.
 */
public record RegistrySnapshot(Map<String, List<RegistryEntry>> entriesByNamespace) {

    public static final RegistrySnapshot EMPTY = new RegistrySnapshot(Collections.emptyMap());

    public List<RegistryEntry> listByType(String namespace, RegistryResourceType type) {
        return entriesByNamespace.getOrDefault(namespace, Collections.emptyList())
                .stream()
                .filter(e -> e.type() == type)
                .toList();
    }

    public List<RegistryEntry> listAll(String namespace) {
        return entriesByNamespace.getOrDefault(namespace, Collections.emptyList());
    }

    /**
     * Returns every entry matching the supplied parts of the composite identity. A {@code null}
     * part is not supplied and therefore does not filter; every supplied part must match. Callers
     * never pick a winner from more than one match — ambiguity is resolved as a 404 above this layer.
     */
    public List<RegistryEntry> find(String namespace, RegistryResourceType type, String name, String path, String variant) {
        return entriesByNamespace.getOrDefault(namespace, Collections.emptyList()).stream()
                .filter(e -> type == null || e.type() == type)
                .filter(e -> name == null || name.equals(e.stem()))
                .filter(e -> path == null || path.equals(e.path()))
                .filter(e -> variant == null || variant.equals(e.variant()))
                .toList();
    }

    public List<String> getNamespaces() {
        return List.copyOf(entriesByNamespace.keySet());
    }
}
