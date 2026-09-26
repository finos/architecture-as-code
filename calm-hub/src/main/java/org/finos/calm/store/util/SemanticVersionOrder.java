package org.finos.calm.store.util;

import org.finos.calm.domain.ResourceVersion;
import org.finos.calm.domain.Semver;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Orders version strings numerically by major, then minor, then patch.
 *
 * <h2>Why not a plain string sort</h2>
 * Lexicographic ordering puts {@code "1.10.0"} before {@code "1.9.0"}, which is
 * wrong for every consumer of a version list. A Mongo {@code find} without an
 * explicit sort has no defined order at all, so the version-document stores must
 * impose one — this is it.
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
        // A snapshot precedes the release it belongs to, per semver pre-release ordering.
        boolean leftSnapshot = ResourceVersion.isSnapshot(leftVersion);
        boolean rightSnapshot = ResourceVersion.isSnapshot(rightVersion);
        if (leftSnapshot != rightSnapshot) {
            return leftSnapshot ? -1 : 1;
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

    /**
     * Resolves "latest" the way every READ consumer expects: the highest release, falling back
     * to the highest snapshot only when no release exists yet.
     *
     * <p>{@link #ASCENDING} ranks a snapshot immediately below the release it belongs to, but the
     * last element of a sorted list is still whichever of the two has the higher version number —
     * so once a snapshot's version number exceeds the newest release (e.g. {@code 1.1.0-SNAPSHOT}
     * past a published {@code 1.0.0}), taking the last element would serve unpublished work as
     * "latest". Maven distinguishes {@code LATEST} (includes snapshots) from {@code RELEASE}
     * (published only); this always resolves to the {@code RELEASE} sense.</p>
     *
     * @return the resolved version, or {@code null} if {@code versions} is null or empty.
     */
    public static String latestRelease(List<String> versions) {
        if (versions == null || versions.isEmpty()) {
            return null;
        }
        List<String> sorted = new ArrayList<>(versions);
        sorted.sort(ASCENDING);
        for (int i = sorted.size() - 1; i >= 0; i--) {
            String version = sorted.get(i);
            if (!ResourceVersion.isSnapshot(version)) {
                return version;
            }
        }
        // Every version is a snapshot — nothing has been published yet.
        return sorted.get(sorted.size() - 1);
    }
}
