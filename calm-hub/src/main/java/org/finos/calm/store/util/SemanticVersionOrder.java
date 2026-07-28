package org.finos.calm.store.util;

import java.util.Comparator;

/**
 * Orders dot-separated version strings ({@code "1.0.0"}) numerically by
 * major, then minor, then patch.
 *
 * <h2>Why not a plain string sort</h2>
 * Lexicographic ordering puts {@code "1.10.0"} before {@code "1.9.0"}, which is
 * wrong for every consumer of a version list. A Mongo {@code find} without an
 * explicit sort has no defined order at all, so the version-document stores must
 * impose one — this is it.
 *
 * <h2>Why this is not {@link VersionKeySelector}</h2>
 * {@code VersionKeySelector.latestVersionKey} parses the <em>dash</em>-encoded
 * keys ({@code "1-0-0"}) used by the pre-redesign document shape, where the
 * version was a Mongo field name and therefore couldn't contain {@code '.'}.
 * Its only remaining callers are the Control stores, which deliberately keep
 * that shape, so it must keep parsing dashes. This class is the dot-separated
 * equivalent for the new shape — deliberately separate, so neither has to
 * handle both formats. See {@code calm-hub/decisions/0002-version-key-encoding.md}.
 *
 * <h2>Malformed input</h2>
 * A version that isn't three numeric segments sorts as {@code 0.0.0} rather than
 * throwing, matching {@link VersionKeySelector}'s existing leniency — stored data
 * predating validation shouldn't make a listing endpoint fail. Ties (including
 * between two malformed values) fall back to a plain string comparison so the
 * order is always total and therefore stable.
 */
public final class SemanticVersionOrder {

    private static final int SEGMENTS = 3;

    /** Ascending: {@code 1.0.0}, {@code 1.9.0}, {@code 1.10.0}, {@code 2.0.0}. */
    public static final Comparator<String> ASCENDING = SemanticVersionOrder::compare;

    private SemanticVersionOrder() {
    }

    private static int compare(String left, String right) {
        int[] leftParts = parse(left);
        int[] rightParts = parse(right);
        for (int i = 0; i < SEGMENTS; i++) {
            int comparison = Integer.compare(leftParts[i], rightParts[i]);
            if (comparison != 0) {
                return comparison;
            }
        }
        // Total-order tiebreak so equal-ranking values (e.g. two unparseable
        // strings, both 0.0.0) still sort deterministically.
        return left.compareTo(right);
    }

    /**
     * Splits a version into its three numeric segments. Compares segment by segment
     * rather than packing them into a single integer, so a large major/minor/patch
     * can't overflow into the neighbouring segment's range.
     */
    private static int[] parse(String version) {
        int[] parts = new int[SEGMENTS];
        String[] segments = version.split("\\.");
        if (segments.length != SEGMENTS) {
            return parts;
        }
        for (int i = 0; i < SEGMENTS; i++) {
            try {
                parts[i] = Integer.parseInt(segments[i]);
            } catch (NumberFormatException e) {
                return new int[SEGMENTS];
            }
        }
        return parts;
    }
}
