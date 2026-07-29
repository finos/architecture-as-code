package org.finos.calm.store.util;

import org.finos.calm.domain.Semver;

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
 * <h2>Why this is not {@link VersionKeySelector}</h2>
 * {@code VersionKeySelector.latestVersionKey} exists to pick a single winner out
 * of the dash-encoded {@code versions} <em>map</em> used by the pre-redesign
 * document shape. Its only remaining callers are the Control stores, which
 * deliberately keep that shape, so it is left alone. This class is the ordering
 * for the new one-document-per-version shape, where version is a field value.
 * See {@code calm-hub/decisions/0002-version-key-encoding.md}.
 *
 * <h2>Separators</h2>
 * Parsing is delegated to {@link Semver#tryParse}, so both the canonical
 * dot-separated form and the dash-encoded form order identically. ADR 0002 has
 * the new {@code <type>Versions} collections storing dots only, so dashes should
 * never reach here — but {@code VERSION_REGEX} accepts either from the API, and a
 * comparator silently demoting {@code "1-10-0"} to {@code 0.0.0} would be a
 * confusing way to find that out. Accepting both costs nothing and keeps this
 * consistent with every other version comparison in the codebase, all of which
 * already go through {@code Semver}.
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
        int comparison = Semver.tryParse(leftVersion).compareTo(Semver.tryParse(rightVersion));
        if (comparison != 0) {
            return comparison;
        }
        // Total-order tiebreak so equal-ranking values (e.g. two unparseable
        // strings, both 0.0.0) still sort deterministically.
        return leftVersion.compareTo(rightVersion);
    }

    /**
     * Maps {@code null} onto a value {@link Semver#tryParse} treats as malformed, so a
     * missing version field sorts with the other unparseable values instead of throwing.
     */
    private static String orEmpty(String version) {
        return version == null ? "" : version;
    }
}
