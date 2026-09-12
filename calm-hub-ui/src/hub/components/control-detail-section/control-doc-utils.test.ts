import { describe, it, expect } from 'vitest';
import {
    formatFieldName,
    isJsonSchemaLike,
    isPlainObject,
    isStringArray,
    isUrlString,
} from './control-doc-utils.js';

describe('control-doc-utils', () => {
    describe('formatFieldName', () => {
        it('title-cases hyphen-separated names', () => {
            expect(formatFieldName('encryption-algorithm')).toBe('Encryption Algorithm');
        });
        it('title-cases underscore-separated names', () => {
            expect(formatFieldName('contributing_factors')).toBe('Contributing Factors');
        });
        it('handles a single word', () => {
            expect(formatFieldName('summary')).toBe('Summary');
        });
    });

    describe('isPlainObject', () => {
        it('accepts objects, rejects arrays and null', () => {
            expect(isPlainObject({})).toBe(true);
            expect(isPlainObject([])).toBe(false);
            expect(isPlainObject(null)).toBe(false);
            expect(isPlainObject('x')).toBe(false);
        });
    });

    describe('isJsonSchemaLike', () => {
        it('is true when a properties object is present', () => {
            expect(isJsonSchemaLike({ type: 'object', properties: { a: {} } })).toBe(true);
        });
        it('is false for a prose document', () => {
            expect(isJsonSchemaLike({ id: 'X', requirements: ['do a thing'] })).toBe(false);
        });
        it('is false for a flat config instance', () => {
            expect(isJsonSchemaLike({ 'control-id': 'X', 'data-at-rest': true })).toBe(false);
        });
    });

    describe('isUrlString', () => {
        it('matches http(s) URLs only', () => {
            expect(isUrlString('https://example.com')).toBe(true);
            expect(isUrlString('http://example.com')).toBe(true);
            expect(isUrlString('90-days')).toBe(false);
            expect(isUrlString(42)).toBe(false);
        });
    });

    describe('isStringArray', () => {
        it('is true for a non-empty all-string array', () => {
            expect(isStringArray(['a', 'b'])).toBe(true);
        });
        it('is false for empty or mixed arrays', () => {
            expect(isStringArray([])).toBe(false);
            expect(isStringArray(['a', 1])).toBe(false);
        });
    });
});
