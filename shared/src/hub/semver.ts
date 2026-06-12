import type { ResourceChangeType } from './calm-hub-client';

/**
 * Computes the next semantic version after applying a change of the given type.
 *
 * - `MAJOR`: increments the major version and resets minor and patch to 0 (e.g. `1.2.3` -> `2.0.0`)
 * - `MINOR`: increments the minor version and resets patch to 0 (e.g. `1.2.3` -> `1.3.0`)
 * - `PATCH`: increments the patch version (e.g. `1.2.3` -> `1.2.4`)
 *
 * @param version The current version, in `MAJOR.MINOR.PATCH` form.
 * @param changeType The kind of change being applied.
 * @returns The bumped version string.
 * @throws Error if the version is not a valid `MAJOR.MINOR.PATCH` string, or the change type is unknown.
 */
export function computeSemVerBump(version: string, changeType: ResourceChangeType): string {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
    if (!match) {
        throw new Error(`Invalid semantic version: '${version}'. Expected MAJOR.MINOR.PATCH.`);
    }

    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);
    const patch = parseInt(match[3], 10);

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
