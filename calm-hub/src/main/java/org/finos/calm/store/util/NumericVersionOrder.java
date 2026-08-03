package org.finos.calm.store.util;

import java.util.Comparator;

/**
 * Orders versions that are plain integers, for resource types whose history is a revision
 * number rather than a semantic version — ADR is the only one.
 *
 * <h2>Why {@link SemanticVersionOrder} cannot be used</h2>
 * It parses each value as {@code major.minor.patch} and maps anything unparseable to
 * {@code 0.0.0}, falling back to a plain string comparison to keep the order total. Every ADR
 * revision is unparseable by that rule, so the whole set collapses to the string tiebreak and
 * sorts {@code 1, 10, 2} — which would make "latest revision" mean revision 2 once an ADR
 * reached double figures, silently returning stale content from every read that resolves the
 * latest.
 *
 * <h2>Malformed input</h2>
 * Anything that isn't an integer sorts before everything that is, and ties are broken by
 * string comparison so the order stays total. Nothing in the current write path can produce
 * such a value — revisions come from {@code latest + 1} — but a comparator that threw would
 * turn one bad stored key into a failure of every listing for that resource.
 */
public final class NumericVersionOrder {

    /** Ascending: {@code 1}, {@code 2}, {@code 10}. */
    public static final Comparator<String> ASCENDING = NumericVersionOrder::compare;

    private NumericVersionOrder() {
    }

    private static int compare(String left, String right) {
        Integer leftValue = parseOrNull(left);
        Integer rightValue = parseOrNull(right);

        if (leftValue != null && rightValue != null) {
            return Integer.compare(leftValue, rightValue);
        }
        if (leftValue == null && rightValue == null) {
            return orEmpty(left).compareTo(orEmpty(right));
        }
        // Unparseable values sort first, so a stray key can never be mistaken for the latest.
        return leftValue == null ? -1 : 1;
    }

    private static Integer parseOrNull(String version) {
        if (version == null) {
            return null;
        }
        try {
            return Integer.valueOf(version.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String orEmpty(String version) {
        return version == null ? "" : version;
    }
}
