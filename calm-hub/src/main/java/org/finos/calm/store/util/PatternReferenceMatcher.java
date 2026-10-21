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
 * <p>The type segment is matched in any case, because a pattern {@code $id} written before #3355
 * can spell it {@code Patterns}, and {@code calm generate} copies the {@code $id} into
 * {@code $schema}. The namespace and the name must match exactly, as they must in the API.</p>
 */
public final class PatternReferenceMatcher {

    private final Pattern path;
    private final Pattern lastPath;

    private PatternReferenceMatcher(Pattern path) {
        this.path = path;
        this.lastPath = Pattern.compile("(?s).*" + path.pattern());
    }

    public static PatternReferenceMatcher of(String namespace, String name) {
        return new PatternReferenceMatcher(Pattern.compile(Pattern.quote("/calm/namespaces/" + namespace + "/")
                + "(?i:patterns)" + Pattern.quote("/" + name + "/versions/")));
    }

    /** Matches the path that every reference to any version of this pattern contains. */
    public Pattern path() {
        return path;
    }

    /** True when {@code schema} names this pattern version, in any spelling of the version. */
    public boolean references(String schema, String version) {
        if (schema == null) {
            return false;
        }
        Matcher last = lastPath.matcher(schema);
        if (!last.find() || last.end() >= schema.length()) {
            return false;
        }
        return CanonicalVersion.of(schema.substring(last.end())).equals(CanonicalVersion.of(version));
    }
}
