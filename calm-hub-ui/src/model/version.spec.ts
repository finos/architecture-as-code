import { describe, it, expect } from 'vitest';
import { compareVersions, isCommitSha, sortVersionsDescending, pickLatestVersion } from './version.js';

describe('compareVersions', () => {
    it('orders dotted numeric versions numerically', () => {
        expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
        expect(compareVersions('2.0.0', '1.9.9')).toBeGreaterThan(0);
        expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    });

    it('treats equal versions as equal', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('treats a missing trailing segment as zero', () => {
        expect(compareVersions('1.0', '1.0.1')).toBeLessThan(0);
        expect(compareVersions('1.0.0', '1.0')).toBe(0);
    });

    it('falls back to string compare for non-numeric labels', () => {
        expect(compareVersions('alpha', 'beta')).toBeLessThan(0);
        expect(compareVersions('beta', 'alpha')).toBeGreaterThan(0);
    });
});

describe('isCommitSha', () => {
    it('accepts abbreviated and full-length lowercase hex SHAs', () => {
        expect(isCommitSha('abc1234')).toBe(true);
        expect(isCommitSha('e46b2d5a1f3c9d8b7e2a0f4c6d8e1b3a5c7d9f0e')).toBe(true);
    });

    it('rejects values shorter than the 7 characters the backend accepts', () => {
        expect(isCommitSha('abc123')).toBe(false);
        expect(isCommitSha('20240')).toBe(false);
    });

    it('rejects values longer than 40 characters, uppercase hex and non-hex characters', () => {
        expect(isCommitSha('a'.repeat(41))).toBe(false);
        expect(isCommitSha('ABC1234')).toBe(false);
        expect(isCommitSha('abc123g')).toBe(false);
    });

    it('rejects semver versions', () => {
        expect(isCommitSha('1.0.0')).toBe(false);
        expect(isCommitSha('2.0.0-beta')).toBe(false);
    });
});

describe('sortVersionsDescending', () => {
    it('returns versions newest-first without mutating the input', () => {
        const input = ['1.0.0', '2.0.0', '1.5.0'];
        const result = sortVersionsDescending(input);
        expect(result).toEqual(['2.0.0', '1.5.0', '1.0.0']);
        expect(input).toEqual(['1.0.0', '2.0.0', '1.5.0']);
    });

    it('reverses SHA versions from chronological to newest-first', () => {
        const input = ['abc1234', 'def5678', 'f1339ab'];
        const result = sortVersionsDescending(input);
        expect(result).toEqual(['f1339ab', 'def5678', 'abc1234']);
    });

    it('does not re-sort SHA versions alphabetically', () => {
        const input = ['aaa1111', 'fff9999', 'bbb2222'];
        const result = sortVersionsDescending(input);
        expect(result).toEqual(['bbb2222', 'fff9999', 'aaa1111']);
    });

    it('sorts short all-digit labels as versions instead of reversing them as SHAs', () => {
        expect(sortVersionsDescending(['20250', '20240', '20260'])).toEqual(['20260', '20250', '20240']);
    });

    // Only the first entry decides which ordering applies, so a mixed list follows it.
    it('reverses a mixed list that starts with a SHA', () => {
        expect(sortVersionsDescending(['abc1234', '1.0.0', '2.0.0'])).toEqual(['2.0.0', '1.0.0', 'abc1234']);
    });

    it('semver-sorts a mixed list that starts with a version', () => {
        expect(sortVersionsDescending(['1.0.0', 'abc1234'])).toEqual(['1.0.0', 'abc1234'].sort((a, b) => compareVersions(b, a)));
    });
});

describe('pickLatestVersion', () => {
    it('returns the newest version', () => {
        expect(pickLatestVersion(['1.0.0', '2.1.0', '2.0.0'])).toBe('2.1.0');
    });

    it('returns undefined for an empty list', () => {
        expect(pickLatestVersion([])).toBeUndefined();
    });

    it('returns the only version when the list has one entry', () => {
        expect(pickLatestVersion(['3.4.5'])).toBe('3.4.5');
    });

    it('returns the last SHA (newest) from chronological list', () => {
        const input = ['abc1234', 'def5678', 'f1339ab'];
        expect(pickLatestVersion(input)).toBe('f1339ab');
    });
});
