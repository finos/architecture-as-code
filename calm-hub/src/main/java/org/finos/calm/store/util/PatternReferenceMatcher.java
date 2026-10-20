package org.finos.calm.store.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
 *
 * <p>The type segment is matched in any case. Before CALM Hub wrote it in lowercase (#3355), it
 * copied the caller's spelling, for example {@code Patterns}, into the pattern's {@code $id}, and
 * {@code calm generate} copied that into {@code $schema}. The namespace and the name must match
 * exactly, as they must in the API.</p>
 */
public final class PatternReferenceMatcher {

    private PatternReferenceMatcher() {
    }

    /** Matches the path that every reference to any version of this pattern contains. */
    public static Pattern pathPattern(String namespace, String name) {
        return Pattern.compile(Pattern.quote("/calm/namespaces/" + namespace + "/") + "(?i:patterns)"
                + Pattern.quote("/" + name + "/versions/"));
    }

    /**
     * True when {@code schema} names this pattern version, in any spelling of the version.
     *
     * @param path from {@link #pathPattern}
     */
    public static boolean references(String schema, Pattern path, String version) {
        if (schema == null) {
            return false;
        }
        Matcher matcher = path.matcher(schema);
        int end = -1;
        // Each search starts one character after the last match, so an overlapping match counts, as with lastIndexOf.
        for (int from = 0; from < schema.length() && matcher.find(from); from = matcher.start() + 1) {
            end = matcher.end();
        }
        if (end < 0 || end >= schema.length()) {
            return false;
        }
        return CanonicalVersion.of(schema.substring(end)).equals(CanonicalVersion.of(version));
    }
}
