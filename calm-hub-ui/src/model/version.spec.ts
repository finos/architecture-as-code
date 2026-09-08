import { describe, it, expect } from 'vitest';
import { compareVersions, sortVersionsDescending, pickLatestVersion } from './version.js';

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
