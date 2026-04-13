package org.finos.calm.domain;

import org.finos.calm.domain.frontcontroller.ChangeType;

/**
 * Immutable value object representing a semantic version (major.minor.patch).
 */
public record Semver(int major, int minor, int patch) implements Comparable<Semver> {

    public static Semver parse(String version) {
        String[] parts = version.replace('-', '.').split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Invalid version format: " + version);
        }
        return new Semver(
                Integer.parseInt(parts[0]),
                Integer.parseInt(parts[1]),
                Integer.parseInt(parts[2])
        );
    }

    public static Semver tryParse(String version) {
        String[] parts = version.replace('-', '.').split("\\.");
        if (parts.length != 3) {
            return new Semver(0, 0, 0);
        }
        try {
            return new Semver(
                    Integer.parseInt(parts[0]),
                    Integer.parseInt(parts[1]),
                    Integer.parseInt(parts[2])
            );
        } catch (NumberFormatException e) {
            return new Semver(0, 0, 0);
        }
    }

    public Semver bump(ChangeType changeType) {
        return switch (changeType) {
            case MAJOR -> new Semver(major + 1, 0, 0);
            case MINOR -> new Semver(major, minor + 1, 0);
            case PATCH -> new Semver(major, minor, patch + 1);
        };
    }

    @Override
    public int compareTo(Semver other) {
        int cmp = Integer.compare(this.major, other.major);
        if (cmp != 0) return cmp;
        cmp = Integer.compare(this.minor, other.minor);
        if (cmp != 0) return cmp;
        return Integer.compare(this.patch, other.patch);
    }

    @Override
    public String toString() {
        return major + "." + minor + "." + patch;
    }
}
