package org.finos.calm.store.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds the expressions that recognise a hub pattern address inside an architecture's
 * {@code $schema}.
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
 * ask with any of them. Comparing the strings verbatim would miss every pair that disagrees.</p>
 */
public final class PatternReferenceMatcher {

    private static final Pattern METACHARACTERS = Pattern.compile("[\\\\^$.|?*+()\\[\\]{}]");

    private PatternReferenceMatcher() {
    }

    /** The expression matching references to one specific pattern version, in any spelling. */
    public static String referenceTo(String namespace, String name, String version) {
        return "/calm/namespaces/" + quote(namespace)
                + "/patterns/" + quote(name)
                + "/versions/" + versionSpellings(version) + "$";
    }

    /**
     * True when {@code schema} names this pattern version. The in-memory counterpart to
     * {@link #referenceTo}, for the backend that cannot push the match down to the database.
     */
    public static boolean references(String schema, String namespace, String name, String version) {
        if (schema == null) {
            return false;
        }
        String prefix = "/calm/namespaces/" + namespace + "/patterns/" + name + "/versions/";
        int start = schema.lastIndexOf(prefix);
        if (start < 0 || start + prefix.length() >= schema.length()) {
            return false;
        }
        String storedVersion = schema.substring(start + prefix.length());
        return CanonicalVersion.of(storedVersion).equals(CanonicalVersion.of(version));
    }

    /**
     * Matches the digits of {@code version} with an optional separator between them, which is the
     * shape {@code VERSION_REGEX} itself accepts. An unrecognised version is escaped and matched
     * literally, so a malformed one cannot widen the expression.
     */
    private static String versionSpellings(String version) {
        String canonical = CanonicalVersion.of(version);
        String[] parts = canonical == null ? null : canonical.split("\\.");
        if (parts == null || parts.length != 3) {
            return quote(version);
        }
        return parts[0] + "[-.]?" + parts[1] + "[-.]?" + parts[2];
    }

    /**
     * Escapes a path segment for use inside a database-side expression. The path parameters reaching
     * here are already constrained to letters, digits, dots and hyphens, so in practice only the dot
     * needs it. The full set is escaped anyway, so a caller reaching the store directly cannot
     * inject an expression.
     */
    private static String quote(String segment) {
        return METACHARACTERS.matcher(segment).replaceAll(Matcher.quoteReplacement("\\") + "$0");
    }
}
