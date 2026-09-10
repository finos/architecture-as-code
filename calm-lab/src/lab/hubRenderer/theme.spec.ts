import { describe, it, expect } from 'vitest';
import { getNodeTypeColor, THEME } from './theme';

describe('getNodeTypeColor', () => {
    it('resolves a known node type, case-insensitively', () => {
        expect(getNodeTypeColor('Database')).toBe(THEME.colors.nodeTypes.database);
    });

    it('falls back to the default colour for an unknown type', () => {
        expect(getNodeTypeColor('quantum-abacus')).toBe(THEME.colors.nodeTypes.default);
    });

    it.each([
        ['a number', 7],
        ['an object', {}],
        ['undefined', undefined],
        ['null', null],
    ])('does not throw when `node-type` is %s', (_label, value) => {
        // A live editor buffer can put anything here; `.toLowerCase()` used to throw.
        expect(getNodeTypeColor(value)).toBe(THEME.colors.nodeTypes.default);
    });
});
