import { describe, expect, it } from 'vitest';
import { CALM_NARRATIVE_DOCUMENT_TYPES_LIST, isNarrativeDocumentType } from './index';

describe('isNarrativeDocumentType', () => {
    it.each(CALM_NARRATIVE_DOCUMENT_TYPES_LIST)('accepts %s', (type) => {
        expect(isNarrativeDocumentType(type)).toBe(true);
    });

    it('rejects unsupported values', () => {
        expect(isNarrativeDocumentType('architecture')).toBe(false);
        expect(isNarrativeDocumentType(1)).toBe(false);
    });
});
