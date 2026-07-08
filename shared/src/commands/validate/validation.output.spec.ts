import { describe, it, expect } from 'vitest';
import { ValidationOutput } from './validation.output';

describe('ValidationOutput factories', () => {
    it('error() builds an error-severity output with no line/character fields', () => {
        const out = ValidationOutput.error('my-code', 'boom', '/nodes/0');
        expect(out.code).toBe('my-code');
        expect(out.severity).toBe('error');
        expect(out.message).toBe('boom');
        expect(out.path).toBe('/nodes/0');
        expect(out.schemaPath).toBeUndefined();
        expect(out.source).toBeUndefined();
        expect(out.line_start).toBeUndefined();
        expect(out.line_end).toBeUndefined();
        expect(out.character_start).toBeUndefined();
        expect(out.character_end).toBeUndefined();
    });

    it('error() applies schemaPath and source options', () => {
        const out = ValidationOutput.error('c', 'm', '/p', { schemaPath: '#/required', source: 'architecture' });
        expect(out.schemaPath).toBe('#/required');
        expect(out.source).toBe('architecture');
    });

    it('warning() builds a warning-severity output', () => {
        const out = ValidationOutput.warning('legacy', 'deprecated', '/', { source: 'architecture' });
        expect(out.severity).toBe('warning');
        expect(out.code).toBe('legacy');
        expect(out.message).toBe('deprecated');
        expect(out.path).toBe('/');
        expect(out.source).toBe('architecture');
    });
});
