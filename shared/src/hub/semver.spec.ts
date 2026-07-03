import { describe, it, expect } from 'vitest';
import { computeSemVerBump, compareSemVer, sortSemVer } from './semver';

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

describe('compareSemVer', () => {
    it('returns a negative number when the first version is lower', () => {
        expect(compareSemVer('1.2.3', '1.2.4')).toBeLessThan(0);
    });

    it('returns a positive number when the first version is higher', () => {
        expect(compareSemVer('2.0.0', '1.9.9')).toBeGreaterThan(0);
    });

    it('returns zero when the versions are equal', () => {
        expect(compareSemVer('1.2.3', '1.2.3')).toBe(0);
    });

    it('orders by major before minor and patch', () => {
        expect(compareSemVer('2.0.0', '1.99.99')).toBeGreaterThan(0);
    });

    it('orders by minor before patch', () => {
        expect(compareSemVer('1.3.0', '1.2.99')).toBeGreaterThan(0);
    });

    it('compares segments numerically rather than lexicographically', () => {
        expect(compareSemVer('1.10.0', '1.9.0')).toBeGreaterThan(0);
    });

    it('trims surrounding whitespace before comparing', () => {
        expect(compareSemVer('  1.2.3 ', '1.2.3')).toBe(0);
    });

    it('throws on an invalid version', () => {
        expect(() => compareSemVer('1.2', '1.2.3')).toThrow(/Invalid semantic version/);
    });
});

describe('sortSemVer', () => {
    it('sorts versions in ascending order', () => {
        expect(sortSemVer(['1.2.0', '1.0.0', '1.10.0', '1.2.3'])).toEqual([
            '1.0.0', '1.2.0', '1.2.3', '1.10.0'
        ]);
    });

    it('does not mutate the input array', () => {
        const input = ['2.0.0', '1.0.0'];
        sortSemVer(input);
        expect(input).toEqual(['2.0.0', '1.0.0']);
    });

    it('returns an empty array unchanged', () => {
        expect(sortSemVer([])).toEqual([]);
    });

    it('handles a single-element array', () => {
        expect(sortSemVer(['1.2.3'])).toEqual(['1.2.3']);
    });

    it('throws on an invalid version in the array', () => {
        expect(() => sortSemVer(['1.0.0', 'nope'])).toThrow(/Invalid semantic version/);
    });
});
