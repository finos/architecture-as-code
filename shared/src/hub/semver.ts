import type { ResourceChangeType } from './calm-hub-client';

/**
 * Suffix marking a version as mutable/in-progress, mirroring CalmHub's
 * `ResourceVersion.SNAPSHOT_SUFFIX` (server-side).
 */
export const SNAPSHOT_SUFFIX = '-SNAPSHOT';

/**
 * Returns true if `version` ends with the snapshot suffix (and is more than just the bare
 * suffix). Mirrors CalmHub's `ResourceVersion.isSnapshot`.
 */
export function isSnapshotVersion(version: string): boolean {
    return version != null && version.endsWith(SNAPSHOT_SUFFIX) && version.length > SNAPSHOT_SUFFIX.length;
}

/** Appends the snapshot suffix, unless it is already present. */
export function toSnapshotVersion(version: string): string {
    return isSnapshotVersion(version) ? version : `${version}${SNAPSHOT_SUFFIX}`;
}

/** Strips the snapshot suffix, if present. No-op otherwise. */
export function toReleaseVersion(version: string): string {
    return isSnapshotVersion(version) ? version.slice(0, -SNAPSHOT_SUFFIX.length) : version;
}

/**
 * Computes the next semantic version after applying a change of the given type.
 *
 * - `MAJOR`: increments the major version and resets minor and patch to 0 (e.g. `1.2.3` -> `2.0.0`)
 * - `MINOR`: increments the minor version and resets patch to 0 (e.g. `1.2.3` -> `1.3.0`)
 * - `PATCH`: increments the patch version (e.g. `1.2.3` -> `1.2.4`)
 *
 * A `-SNAPSHOT` suffix on the input is stripped before computing; the caller is expected to
 * re-apply it with `toSnapshotVersion` if needed.
 *
 * @param version The current version, in `MAJOR.MINOR.PATCH` form (optionally `-SNAPSHOT` suffixed).
 * @param changeType The kind of change being applied.
 * @returns The bumped version string.
 * @throws Error if the version is not a valid `MAJOR.MINOR.PATCH` string, or the change type is unknown.
 */
function parseSemVer(version: string): [number, number, number] {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(toReleaseVersion(version.trim()));
    if (!match) {
        throw new Error(`Invalid semantic version: '${version}'. Expected MAJOR.MINOR.PATCH.`);
    }
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

export function computeSemVerBump(version: string, changeType: ResourceChangeType): string {
    const [major, minor, patch] = parseSemVer(version);

    switch (changeType) {
    case 'MAJOR':
        return `${major + 1}.0.0`;
    case 'MINOR':
        return `${major}.${minor + 1}.0`;
    case 'PATCH':
        return `${major}.${minor}.${patch + 1}`;
    default:
        throw new Error(`Unknown change type: '${changeType}'.`);
    }
}

/**
 * Compares two semantic versions numerically, segment by segment. When the numeric parts are
 * equal, a snapshot sorts before its release (e.g. `1.0.0-SNAPSHOT` < `1.0.0`), matching
 * CalmHub's `SemanticVersionOrder`.
 *
 * Suitable as an `Array.prototype.sort` comparator for ascending order.
 *
 * @param a The first version, in `MAJOR.MINOR.PATCH` form (optionally `-SNAPSHOT` suffixed).
 * @param b The second version, in `MAJOR.MINOR.PATCH` form (optionally `-SNAPSHOT` suffixed).
 * @returns A negative number if `a < b`, a positive number if `a > b`, or `0` if they are equal.
 * @throws Error if either version is not a valid `MAJOR.MINOR.PATCH` string.
 */
export function compareSemVer(a: string, b: string): number {
    const parsedA = parseSemVer(a);
    const parsedB = parseSemVer(b);

    for (let i = 0; i < parsedA.length; i++) {
        if (parsedA[i] !== parsedB[i]) {
            return parsedA[i] - parsedB[i];
        }
    }

    const aSnapshot = isSnapshotVersion(a);
    const bSnapshot = isSnapshotVersion(b);
    if (aSnapshot !== bSnapshot) {
        return aSnapshot ? -1 : 1;
    }
    return 0;
}

/**
 * Returns a new array of semantic versions sorted in ascending order.
 *
 * The input array is not mutated; the highest version is the last element.
 *
 * @param versions The versions to sort, each in `MAJOR.MINOR.PATCH` form (optionally `-SNAPSHOT` suffixed).
 * @returns A new, ascending-sorted array of versions.
 * @throws Error if any version is not a valid `MAJOR.MINOR.PATCH` string.
 */
export function sortSemVer(versions: string[]): string[] {
    return [...versions].sort(compareSemVer);
}
