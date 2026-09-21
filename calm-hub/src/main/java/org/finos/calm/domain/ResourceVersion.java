package org.finos.calm.domain;

/**
 * The one place that knows how a snapshot version is spelled.
 *
 * <h2>Why this is a type and not a string check</h2>
 * {@link org.finos.calm.store.util.VersionScheme} records why version spelling and version ordering became one type:
 * left independent, they drifted, and an ADR revision was silently stored and read under the
 * wrong version. Snapshot-ness is a third property of the same string. A call to
 * {@code endsWith("-SNAPSHOT")} scattered through the resource, service and store layers is
 * the same mistake in a new place — each copy free to disagree about case, about a bare
 * suffix, or about null.
 *
 * <p>Canonicalisation stays in {@link org.finos.calm.store.util.CanonicalVersion} and ordering in
 * {@link org.finos.calm.store.util.SemanticVersionOrder}. This class answers only "is it a snapshot, and what release
 * does it belong to", and both of those delegate to it.</p>
 */
public final class ResourceVersion {

    public static final String SNAPSHOT_SUFFIX = "-SNAPSHOT";

    private ResourceVersion() {
    }

    /**
     * @param version any version string, or {@code null}
     * @return {@code true} only for a version with content before the suffix. {@code null},
     * a lowercase suffix and a bare {@code "-SNAPSHOT"} are all {@code false}: the suffix is
     * a fixed token, and accepting variants would give one logical version several documents.
     */
    public static boolean isSnapshot(String version) {
        return version != null
                && version.endsWith(SNAPSHOT_SUFFIX)
                && version.length() > SNAPSHOT_SUFFIX.length();
    }

    /**
     * @return the version with any snapshot suffix removed, in its original spelling.
     * Folding the spelling is {@link org.finos.calm.store.util.CanonicalVersion}'s job; doing it here as well would
     * put one rule in two places.
     */
    public static String releaseVersion(String version) {
        if (!isSnapshot(version)) {
            return version;
        }
        return version.substring(0, version.length() - SNAPSHOT_SUFFIX.length());
    }

    /** @return {@code version} unchanged if it is {@code null} or already a snapshot. */
    public static String asSnapshot(String version) {
        if (version == null || isSnapshot(version)) {
            return version;
        }
        return version + SNAPSHOT_SUFFIX;
    }
}
