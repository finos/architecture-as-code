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

    it('treats a missing trailing segment as lower', () => {
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
});
