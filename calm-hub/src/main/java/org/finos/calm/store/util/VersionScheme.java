package org.finos.calm.store.util;

import java.util.Comparator;
import java.util.function.UnaryOperator;

/**
 * How a resource type spells and ranks its versions. Every version-store helper holds one,
 * and every version string entering or leaving a helper passes through it.
 *
 * <h2>Why these two things are one type</h2>
 * They are not independent, and treating them as independent has already caused a bug.
 * Ordering was made pluggable when ADR arrived, because {@link SemanticVersionOrder} ranks
 * integer revisions {@code 1, 10, 2}; canonicalisation was left hard-wired to
 * {@link CanonicalVersion}. Nothing then forced the pair to agree, and for ADR they did not:
 *
 * <ul>
 *   <li>{@code VERSION_REGEX} makes both separators optional, so {@code "100"} is one of the
 *       six accepted spellings of {@code 1.0.0}. ADR revision 100 was therefore stored as
 *       {@code "1.0.0"} — revisions 1–99 are unaffected, which is exactly why no test caught
 *       it.</li>
 *   <li>{@code "1.0.0"} is not parseable as an integer, and {@link NumericVersionOrder} sorts
 *       unparseable values <em>first</em>. So revision 100 sorted below revision 99, and the
 *       "latest revision" read — which every ADR read goes through — silently returned
 *       revision 99's content while 100 existed. That is the precise failure
 *       {@code NumericVersionOrder} was introduced to prevent, arriving through a different
 *       door.</li>
 *   <li>{@code MongoAdrStore.getAdrRevisions} then calls {@code Integer.parseInt} on the
 *       stored strings, so listing revisions threw rather than returning a wrong answer.</li>
 * </ul>
 *
 * Bundling them makes the mismatch unrepresentable: a caller picks a scheme, not a comparator
 * and separately a spelling rule it has to remember to match.
 */
public enum VersionScheme {

    /**
     * Semantic versions, for every type but ADR. Folds the several accepted spellings of one
     * version onto {@code major.minor.patch} so each logical version is one stored document.
     */
    SEMANTIC(CanonicalVersion::of, SemanticVersionOrder.ASCENDING),

    /**
     * Integer revisions, for ADR. Stored verbatim: there is nothing to fold, since one
     * revision has exactly one spelling, and rewriting them is what corrupted them.
     */
    NUMERIC(UnaryOperator.identity(), NumericVersionOrder.ASCENDING);

    private final UnaryOperator<String> canonicaliser;
    private final Comparator<String> order;

    VersionScheme(UnaryOperator<String> canonicaliser, Comparator<String> order) {
        this.canonicaliser = canonicaliser;
        this.order = order;
    }

    /** @return the form this version is stored and queried under. {@code null} passes through. */
    public String canonicalise(String version) {
        return canonicaliser.apply(version);
    }

    /** @return ascending order, so the last element of a sorted list is the latest. */
    public Comparator<String> order() {
        return order;
    }
}
