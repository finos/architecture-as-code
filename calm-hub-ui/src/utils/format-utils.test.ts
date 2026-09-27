import { describe, it, expect } from 'vitest';
import { formatFieldName } from './format-utils.js';

describe('formatFieldName', () => {
    it('capitalises each word separated by hyphens', () => {
        expect(formatFieldName('risk-level')).toBe('Risk Level');
    });

    it('capitalises each word separated by underscores', () => {
        expect(formatFieldName('contributing_factors')).toBe('Contributing Factors');
    });

    it('handles a single word', () => {
        expect(formatFieldName('summary')).toBe('Summary');
    });

    it('handles multiple hyphens', () => {
        expect(formatFieldName('some-long-field-name')).toBe('Some Long Field Name');
    });
});
