/**
 * Compare two CALM version strings.
 *
 * Versions are usually dotted numeric strings (e.g. "1.0.0"), but may also be
 * arbitrary labels. Numeric dotted versions are compared segment-by-segment
 * numerically; any non-numeric segment falls back to a locale string compare so
 * the ordering stays stable for non-semver labels.
 *
 * Returns a negative number when `a < b`, positive when `a > b`, and 0 when equal.
 */
export function compareVersions(a: string, b: string): number {
    const segsA = a.split('.');
    const segsB = b.split('.');
    const len = Math.max(segsA.length, segsB.length);
    for (let i = 0; i < len; i++) {
        const aMissing = i >= segsA.length;
        const bMissing = i >= segsB.length;
        const rawA = aMissing ? '' : segsA[i];
        const rawB = bMissing ? '' : segsB[i];
        // A missing trailing segment counts as 0, so "1.0" and "1.0.0" compare equal.
        const numA = aMissing ? 0 : Number(rawA);
        const numB = bMissing ? 0 : Number(rawB);
        const aNumeric = aMissing || (rawA !== '' && !Number.isNaN(numA));
        const bNumeric = bMissing || (rawB !== '' && !Number.isNaN(numB));
        if (aNumeric && bNumeric) {
            if (numA !== numB) return numA - numB;
        } else if (rawA !== rawB) {
            return rawA.localeCompare(rawB);
        }
    }
    return 0;
}

/**
 * Return versions sorted newest-first.
 */
export function sortVersionsDescending(versions: string[]): string[] {
    return [...versions].sort((a, b) => compareVersions(b, a));
}

/**
 * Pick the latest (newest) version from a list, or undefined when the list is empty.
 */
export function pickLatestVersion(versions: string[]): string | undefined {
    if (versions.length === 0) return undefined;
    return sortVersionsDescending(versions)[0];
}
