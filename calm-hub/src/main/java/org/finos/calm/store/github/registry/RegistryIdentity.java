package org.finos.calm.store.github.registry;

/**
 * Matches the composite identity parts of a GitHub resource against a registry entry.
 *
 * <p>A {@code null} part is not supplied and does not filter. An empty string is supplied and
 * means "no path" or "no variant" — the root file or the single-extension file. Without that
 * distinction a caller cannot ask for the root {@code foo.json} when {@code team/foo.json} also
 * exists: it gets an ambiguous id and a 404.</p>
 */
public final class RegistryIdentity {

    private RegistryIdentity() {
    }

    public static boolean matches(String name, String path, String variant, RegistryEntry entry) {
        return (name == null || name.equals(entry.stem()))
                && (path == null || normalise(path).equals(normalise(entry.path())))
                && (variant == null || normalise(variant).equals(normalise(entry.variant())));
    }

    private static String normalise(String part) {
        return part == null ? "" : part;
    }
}
