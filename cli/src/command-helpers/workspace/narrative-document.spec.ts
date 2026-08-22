import { describe, expect, it } from 'vitest';
import { parseNarrativeDocument, parseNarrativeDocumentLocation, validateNarrativeIdentity } from './narrative-document';

describe('narrative document helpers', () => {
    const identity = { namespace: 'finos', type: 'sad' as const, version: '1.0.0' };

    it('uses frontmatter title and preserves CRLF Markdown', () => {
        const markdown = '---\r\ntitle: Payments SAD\r\ndescription: Decisions\r\n---\r\n# Content\r\n';
        expect(parseNarrativeDocument(markdown, 'payments')).toEqual({
            request: { name: 'Payments SAD', description: 'Decisions', documentMarkdown: markdown }, markdown,
        });
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
        expect(() => validateNarrativeIdentity({ ...identity, version: 'latest' }, false)).toThrow(/major.minor.patch/);
        expect(() => parseNarrativeDocumentLocation('/api/calm/namespaces/other/documents/sad/42/versions/1.0.0', identity)).toThrow(/does not match/);
    });
});
