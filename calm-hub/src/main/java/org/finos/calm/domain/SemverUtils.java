package org.finos.calm.domain;

/**
 * Utility class for semantic versioning operations.
 */
public class SemverUtils {

    private SemverUtils() {
        throw new UnsupportedOperationException("This is a utility class and cannot be instantiated");
    }

    /**
     * Bumps a semantic version string according to the given change type.
     *
     * @param currentVersion the current version in dot format (e.g. "1.2.3")
     * @param changeType     one of "MAJOR", "MINOR", or "PATCH"
     * @return the bumped version string
     * @throws IllegalArgumentException if the changeType is not recognized or the version format is invalid
     */
    public static String bumpVersion(String currentVersion, String changeType) {
        String[] parts = currentVersion.replace('-', '.').split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Invalid version format: " + currentVersion);
        }

        int major = Integer.parseInt(parts[0]);
        int minor = Integer.parseInt(parts[1]);
        int patch = Integer.parseInt(parts[2]);

        return switch (changeType.toUpperCase()) {
            case "MAJOR" -> (major + 1) + ".0.0";
            case "MINOR" -> major + "." + (minor + 1) + ".0";
            case "PATCH" -> major + "." + minor + "." + (patch + 1);
            default -> throw new IllegalArgumentException("Invalid change type: " + changeType + ". Must be MAJOR, MINOR, or PATCH");
        };
    }

    /**
     * Converts a semver string to a sortable long value for comparison.
     * Each part is shifted to occupy a distinct range: major * 1_000_000 + minor * 1_000 + patch.
     *
     * @param version the version in dot or hyphen format (e.g. "1.2.3" or "1-2-3")
     * @return a long suitable for natural ordering
     */
    public static long parseSortableVersion(String version) {
        String[] parts = version.replace('-', '.').split("\\.");
        if (parts.length != 3) {
            return 0L;
        }
        try {
            long major = Long.parseLong(parts[0]);
            long minor = Long.parseLong(parts[1]);
            long patch = Long.parseLong(parts[2]);
            return major * 1_000_000 + minor * 1_000 + patch;
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
