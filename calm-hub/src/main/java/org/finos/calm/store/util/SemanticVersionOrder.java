package org.finos.calm.store.util;

import java.math.BigInteger;
import java.util.Comparator;

/**
 * Orders version strings numerically by major, then minor, then patch.
 *
 * <h2>Why not a plain string sort</h2>
 * Lexicographic ordering puts {@code "1.10.0"} before {@code "1.9.0"}, which is
 * wrong for every consumer of a version list. A Mongo {@code find} without an
 * explicit sort has no defined order at all, so the version-document stores must
 * impose one — this is it.
 *
 * Accepts dot and dash separators. Components use BigInteger so versions
 * accepted by the API can exceed the Java integer range without losing order.
 *
 * <h2>Malformed input</h2>
 * A version that isn't three numeric segments — including {@code null} — sorts as
 * {@code 0.0.0} rather than throwing: stored data predating validation shouldn't
 * make a listing endpoint fail, and {@code listVersions} reads the version field
 * straight out of a document, so an absent field arrives here as {@code null}.
 * Ties (including between two malformed values) fall back to a plain string
 * comparison so the order is always total and therefore stable.
 */
public final class SemanticVersionOrder {

    /** Ascending: {@code 1.0.0}, {@code 1.9.0}, {@code 1.10.0}, {@code 2.0.0}. */
    public static final Comparator<String> ASCENDING = SemanticVersionOrder::compare;

    private SemanticVersionOrder() {
    }

    private static int compare(String left, String right) {
        String leftVersion = orEmpty(left);
        String rightVersion = orEmpty(right);
        int comparison = parseOrZero(leftVersion).compareTo(parseOrZero(rightVersion));
        if (comparison != 0) {
            return comparison;
        }
        // Total-order tiebreak so equal-ranking values (e.g. two unparseable
        // strings, both 0.0.0) still sort deterministically.
        return leftVersion.compareTo(rightVersion);
    }

    /**
     * Maps {@code null} onto an empty string, so a
     * missing version field sorts with the other unparseable values instead of throwing.
     */
    private static String orEmpty(String version) {
        return version == null ? "" : version;
    }

    private static ComparableVersion parseOrZero(String version) {
        String[] parts = version.replace('-', '.').split("\\.");
        if (parts.length != 3) {
            return ComparableVersion.ZERO;
        }
        try {
            return new ComparableVersion(new BigInteger(parts[0]), new BigInteger(parts[1]), new BigInteger(parts[2]));
        } catch (NumberFormatException exception) {
            return ComparableVersion.ZERO;
        }
    }

    private record ComparableVersion(BigInteger major, BigInteger minor, BigInteger patch)
            implements Comparable<ComparableVersion> {
        private static final ComparableVersion ZERO = new ComparableVersion(BigInteger.ZERO, BigInteger.ZERO, BigInteger.ZERO);

        @Override
        public int compareTo(ComparableVersion other) {
            int comparison = major.compareTo(other.major);
            if (comparison != 0) return comparison;
            comparison = minor.compareTo(other.minor);
            return comparison != 0 ? comparison : patch.compareTo(other.patch);
        }
    }
}
