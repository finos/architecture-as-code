import { describe, it, expect } from 'vitest';
import { resolvePointer } from './jsonPointer.js';

describe('resolvePointer', () => {
    const doc = { status: 'met', control: { 'unique-id': 'c1' }, 'a/b': 1, 'm~n': 2, list: ['x', 'y'] };

    it('resolves object keys, nested keys and array indexes', () => {
        expect(resolvePointer(doc, '/status')).toBe('met');
        expect(resolvePointer(doc, '/control/unique-id')).toBe('c1');
        expect(resolvePointer(doc, '/list/1')).toBe('y');
        expect(resolvePointer(doc, '')).toBe(doc);
    });

    it('unescapes ~1 and ~0', () => {
        expect(resolvePointer(doc, '/a~1b')).toBe(1);
        expect(resolvePointer(doc, '/m~0n')).toBe(2);
    });

    it('returns undefined for a missing step, a bad index, an inherited key or a malformed pointer', () => {
        expect(resolvePointer(doc, '/missing/deeper')).toBeUndefined();
        expect(resolvePointer(doc, '/list/01')).toBeUndefined();
        expect(resolvePointer(doc, '/list/-')).toBeUndefined();
        expect(resolvePointer(doc, '/toString')).toBeUndefined();
        expect(resolvePointer(doc, 'status')).toBeUndefined();
        expect(resolvePointer(null, '/status')).toBeUndefined();
    });
});
