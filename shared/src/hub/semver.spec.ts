import { describe, it, expect } from 'vitest';
import { computeSemVerBump } from './semver';

describe('computeSemVerBump', () => {
    describe('MAJOR', () => {
        it('increments major and resets minor and patch to 0', () => {
            expect(computeSemVerBump('1.2.3', 'MAJOR')).toBe('2.0.0');
        });

        it('increments major from a zero baseline', () => {
            expect(computeSemVerBump('0.0.0', 'MAJOR')).toBe('1.0.0');
        });

        it('handles multi-digit major versions', () => {
            expect(computeSemVerBump('19.4.7', 'MAJOR')).toBe('20.0.0');
        });
    });

    describe('MINOR', () => {
        it('increments minor and resets patch to 0', () => {
            expect(computeSemVerBump('1.2.3', 'MINOR')).toBe('1.3.0');
        });

        it('preserves the major version', () => {
            expect(computeSemVerBump('4.0.9', 'MINOR')).toBe('4.1.0');
        });

        it('handles multi-digit minor versions', () => {
            expect(computeSemVerBump('1.9.0', 'MINOR')).toBe('1.10.0');
        });
    });

    describe('PATCH', () => {
        it('increments patch only', () => {
            expect(computeSemVerBump('1.2.3', 'PATCH')).toBe('1.2.4');
        });

        it('preserves major and minor', () => {
            expect(computeSemVerBump('2.5.0', 'PATCH')).toBe('2.5.1');
        });

        it('handles multi-digit patch versions', () => {
            expect(computeSemVerBump('1.0.99', 'PATCH')).toBe('1.0.100');
        });
    });

    describe('input handling', () => {
        it('trims surrounding whitespace before parsing', () => {
            expect(computeSemVerBump('  1.2.3  ', 'PATCH')).toBe('1.2.4');
        });

        it('throws on a version with fewer than three segments', () => {
            expect(() => computeSemVerBump('1.2', 'PATCH')).toThrow(/Invalid semantic version/);
        });

        it('throws on a version with non-numeric segments', () => {
            expect(() => computeSemVerBump('1.2.x', 'PATCH')).toThrow(/Invalid semantic version/);
        });

        it('throws on a version with a pre-release suffix', () => {
            expect(() => computeSemVerBump('1.2.3-rc.1', 'MINOR')).toThrow(/Invalid semantic version/);
        });

        it('throws on an empty string', () => {
            expect(() => computeSemVerBump('', 'MAJOR')).toThrow(/Invalid semantic version/);
        });

        it('throws on an unknown change type', () => {
            expect(() => computeSemVerBump('1.2.3', 'SIDEWAYS' as never)).toThrow(/Unknown change type/);
        });
    });
});
