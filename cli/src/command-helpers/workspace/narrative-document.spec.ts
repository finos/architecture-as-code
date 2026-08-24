import { describe, expect, it } from 'vitest';
import { CALM_NARRATIVE_DOCUMENT_TYPES_LIST } from '@finos/calm-models/types';
import {
    constructNarrativeDocumentPath,
    parseNarrativeDocument,
    parseNarrativeDocumentLocation,
    validateNarrativeDocumentLocation,
    validateNarrativeIdentity,
} from './narrative-document';

describe('narrative document helpers', () => {
    const identity = { namespace: 'finos', type: 'sad' as const, version: '1.0.0' };

    it('uses frontmatter title and preserves CRLF Markdown', () => {
        const markdown = '---\r\ntitle: Payments SAD\r\ndescription: Decisions\r\n---\r\n# Content\r\n';
        expect(parseNarrativeDocument(markdown, 'payments')).toEqual({
            request: { name: 'Payments SAD', description: 'Decisions', documentMarkdown: markdown },
        });
    });

    it('publishes without an optional description and rejects malformed YAML', () => {
        const markdown = '---\ntitle: Payments SAD\n---\n# Content';
        expect(parseNarrativeDocument(markdown, 'payments').request).toEqual({ name: 'Payments SAD', documentMarkdown: markdown });
        expect(() => parseNarrativeDocument('---\ntitle: [\n---\n# Broken', 'broken')).toThrow(/malformed YAML/);
    });

    it.each([
        '# No frontmatter',
        '---\n---\n# Empty mapping',
        '---\n- one\n---\n# Array',
        '---\ntitle: 42\n---\n# Invalid title',
        '---\ntitle: Good\ndescription: 42\n---\n# Invalid description',
    ])('rejects invalid frontmatter', (markdown) => {
        expect(() => parseNarrativeDocument(markdown, 'bad')).toThrow(/Narrative document/);
    });

    it('validates identity and matching Location', () => {
        validateNarrativeIdentity(identity, false);
        expect(parseNarrativeDocumentLocation('/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0', identity)).toBe(42);
        expect(parseNarrativeDocumentLocation('http://localhost:8080/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0', identity)).toBe(42);
        expect(() => validateNarrativeIdentity({ ...identity, version: 'latest' }, false)).toThrow(/major.minor.patch/);
        expect(() => parseNarrativeDocumentLocation('/api/calm/namespaces/other/documents/sad/42/versions/1.0.0', identity)).toThrow(/does not match/);
    });

    it.each(CALM_NARRATIVE_DOCUMENT_TYPES_LIST)('accepts the supported %s Location type', (type) => {
        const narrativeIdentity = { ...identity, type };
        expect(parseNarrativeDocumentLocation(
            `/api/calm/namespaces/finos/documents/${type}/42/versions/1.0.0`,
            narrativeIdentity
        )).toBe(42);
    });

    it.each([
        [{ ...identity, namespace: 'not_valid' }, false, /valid namespace/],
        [{ ...identity, namespace: 42 }, false, /valid namespace/],
        [{ ...identity, type: 'other' as never }, false, /unsupported/],
        [{ ...identity, version: 1 }, false, /major.minor.patch/],
        [{ ...identity, version: '01.0.0' }, false, /major.minor.patch/],
        [{ ...identity, calmHubDocumentId: 0 }, true, /positive integer/],
    ])('rejects invalid persisted identity %#', (candidate, requireId, message) => {
        expect(() => validateNarrativeIdentity(candidate, requireId)).toThrow(message);
    });

    it('rejects malformed and mismatched persisted Locations', () => {
        expect(() => parseNarrativeDocumentLocation('not-a-location', identity)).toThrow(/unexpected format/);
        expect(() => parseNarrativeDocumentLocation('/api/calm/namespaces/finos/documents/sad/0/versions/1.0.0', identity)).toThrow(/invalid document id/);
        expect(() => parseNarrativeDocumentLocation(
            '/api/calm/namespaces/finos/documents/sad/43/versions/1.0.0',
            { ...identity, calmHubDocumentId: 42 }
        )).toThrow(/stored document id/);
        expect(() => parseNarrativeDocumentLocation(null, identity)).toThrow(/unexpected format/);
        expect(() => parseNarrativeDocumentLocation(
            '/api/calm/namespaces/finos/documents/sad/42/versions/01.0.0', identity, false
        )).toThrow(/unexpected format/);
        expect(parseNarrativeDocumentLocation(
            '/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0',
            { ...identity, version: '1.1.0', calmHubDocumentId: 42 }, false
        )).toBe(42);
    });

    it('validates persisted Locations and constructs canonical paths', () => {
        const storedIdentity = { ...identity, calmHubDocumentId: 42 };
        expect(() => validateNarrativeDocumentLocation(
            '/api/calm/namespaces/other/documents/sad/42/versions/1.0.0', storedIdentity
        )).toThrow(/does not match/);
        expect(constructNarrativeDocumentPath(storedIdentity)).toBe(
            '/api/calm/namespaces/finos/documents/sad/42/versions/1.0.0'
        );
    });
});
