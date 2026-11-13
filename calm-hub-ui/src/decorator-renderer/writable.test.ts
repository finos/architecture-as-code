import { describe, expect, it } from 'vitest';
import { writableDecorator } from './writable.js';

describe('writableDecorator', () => {
    it('uses the field names of a write, in order, and leaves out the Hub-owned times', () => {
        const writable = writableDecorator({
            data: { status: 'met' },
            appliesTo: ['api'],
            creationDateTime: '2026-11-01T10:00:00Z',
            updateDateTime: '2026-11-02T10:00:00Z',
            uniqueId: 'd1',
            schema: 'https://example.org/s.json',
            type: 'scan',
            target: ['/t'],
            targetType: ['architecture'],
        });
        expect(Object.keys(writable)).toEqual(['$schema', 'unique-id', 'type', 'target', 'target-type', 'applies-to', 'data']);
        expect(writable).toEqual({
            $schema: 'https://example.org/s.json',
            'unique-id': 'd1',
            type: 'scan',
            target: ['/t'],
            'target-type': ['architecture'],
            'applies-to': ['api'],
            data: { status: 'met' },
        });
    });

    it('leaves out fields that are missing, and keeps a field that the read API does not name', () => {
        expect(writableDecorator({ type: 'scan', extra: 1, data: null })).toEqual({ type: 'scan', data: null, extra: 1 });
    });

    it('does not let an unknown field replace a mapped one', () => {
        expect(writableDecorator({ uniqueId: 'd1', 'unique-id': 'other' })).toEqual({ 'unique-id': 'd1' });
    });

    it('keeps an unknown field whose name the prototype also has', () => {
        expect(writableDecorator({ uniqueId: 'd1', constructor: 'x', toString: 'y' })).toEqual({ 'unique-id': 'd1', constructor: 'x', toString: 'y' });
    });
});
