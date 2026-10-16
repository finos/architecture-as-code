package org.finos.calm.store.util;

/**
 * Recognises a hub pattern address inside an architecture's {@code $schema}.
 *
 * <p>Only the path is matched, never the host. A stored {@code $schema} carries whatever base URL
 * the hub was serving under when the architecture was generated, so comparing the whole URL would
 * lose every reference the moment a deployment moved. The path alone is still unambiguous: within
 * one hub, namespace plus name plus version identifies exactly one pattern version, which the
 * unique index on {@code resource_mappings} already guarantees.</p>
 *
 * <p>The cost of that choice is that a reference to a <em>different</em> hub with the same
 * namespace, name and version matches too. Distinguishing them would mean trusting the host, which
 * is the thing that does not survive a move.</p>
 *
 * <p>The version is matched in every spelling the API accepts. {@code CalmDocumentParser.rewriteId}
 * writes the requested path version into {@code $id} without canonicalising it, and
 * {@code calm generate} copies that into the architecture's {@code $schema}. A stored reference can
 * therefore read {@code 1.0.0}, {@code 1-0-0} or {@code 100} for the same version, and a caller can
 * ask with any of them.</p>
 */
public final class PatternReferenceMatcher {

    private PatternReferenceMatcher() {
    }

    /** The path that every reference to any version of this pattern contains. */
    public static String pathTo(String namespace, String name) {
        return "/calm/namespaces/" + namespace + "/patterns/" + name + "/versions/";
    }

    /** True when {@code schema} names this pattern version, in any spelling of the version. */
    public static boolean references(String schema, String namespace, String name, String version) {
        if (schema == null) {
            return false;
        }
        String path = pathTo(namespace, name);
        int start = schema.lastIndexOf(path);
        if (start < 0 || start + path.length() >= schema.length()) {
            return false;
        }
        String storedVersion = schema.substring(start + path.length());
        return CanonicalVersion.of(storedVersion).equals(CanonicalVersion.of(version));
    }
}
