import { describe, it, expect } from 'vitest';
import { coerceValue } from './ControlsList';
import type { RequirementPropertyDef } from '../../extension/services/requirement-parser';

describe('ControlsList coerceValue', () => {
    it('returns undefined for empty string', () => {
        const def: RequirementPropertyDef = { type: 'string' };
        expect(coerceValue(def, '')).toBeUndefined();
    });

    it('coerces boolean "true"', () => {
        const def: RequirementPropertyDef = { type: 'boolean' };
        expect(coerceValue(def, 'true')).toBe(true);
    });

    it('coerces boolean "false"', () => {
        const def: RequirementPropertyDef = { type: 'boolean' };
        expect(coerceValue(def, 'false')).toBe(false);
    });

    it('coerces number', () => {
        const def: RequirementPropertyDef = { type: 'number' };
        expect(coerceValue(def, '42.5')).toBe(42.5);
    });

    it('coerces integer', () => {
        const def: RequirementPropertyDef = { type: 'integer' };
        expect(coerceValue(def, '10')).toBe(10);
    });

    it('returns undefined for invalid number', () => {
        const def: RequirementPropertyDef = { type: 'number' };
        expect(coerceValue(def, 'abc')).toBeUndefined();
    });

    it('matches enum value', () => {
        const def: RequirementPropertyDef = { type: 'enum', allowedValues: ['low', 'medium', 'high'] };
        expect(coerceValue(def, 'medium')).toBe('medium');
    });

    it('falls back to raw string for unmatched enum', () => {
        const def: RequirementPropertyDef = { type: 'enum', allowedValues: ['low', 'high'] };
        expect(coerceValue(def, 'custom')).toBe('custom');
    });

    it('returns raw string for string type', () => {
        const def: RequirementPropertyDef = { type: 'string' };
        expect(coerceValue(def, 'hello')).toBe('hello');
    });
});
