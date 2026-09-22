import { describe, it, expect } from 'vitest';
import { isCurie, parseCurie, expandCurie, CurieComponents } from './curie.js';

describe('isCurie', () => {
    it('returns true for a valid CURIE with version', () => {
        expect(isCurie('fae-calm:building-blocks:my-block@a1b2c3d')).toBe(true);
    });

    it('returns true for a valid CURIE without version', () => {
        expect(isCurie('fae-calm:building-blocks:my-block')).toBe(true);
    });

    it('returns true for simple namespaces', () => {
        expect(isCurie('ns:type:slug')).toBe(true);
    });

    it('returns false for URLs (contains slashes before first colon)', () => {
        expect(isCurie('https://example.com/path')).toBe(false);
    });

    it('returns false for http URLs', () => {
        expect(isCurie('http://hub.example.com/calm/namespaces/foo')).toBe(false);
    });

    it('returns false for file paths', () => {
        expect(isCurie('/some/file/path.json')).toBe(false);
    });

    it('returns false for plain strings with no colons', () => {
        expect(isCurie('just-a-string')).toBe(false);
    });

    it('returns false for strings with only one colon', () => {
        expect(isCurie('foo:bar')).toBe(false);
    });

    it('returns false for strings with more than two colons', () => {
        expect(isCurie('foo:bar:baz:qux')).toBe(false);
    });

    it('returns false when namespace contains a dot (e.g. domain-like)', () => {
        expect(isCurie('example.com:type:slug')).toBe(false);
    });
});

describe('parseCurie', () => {
    it('extracts components correctly with version', () => {
        const result = parseCurie('fae-calm:building-blocks:my-block@a1b2c3d');
        expect(result).toEqual({
            namespace: 'fae-calm',
            type: 'building-blocks',
            slug: 'my-block',
            version: 'a1b2c3d',
        } satisfies CurieComponents);
    });

    it('extracts components correctly without version', () => {
        const result = parseCurie('fae-calm:building-blocks:my-block');
        expect(result).toEqual({
            namespace: 'fae-calm',
            type: 'building-blocks',
            slug: 'my-block',
        } satisfies CurieComponents);
    });

    it('handles version with multiple characters after @', () => {
        const result = parseCurie('ns:patterns:api-gateway@v1.2.3');
        expect(result).toEqual({
            namespace: 'ns',
            type: 'patterns',
            slug: 'api-gateway',
            version: 'v1.2.3',
        });
    });

    it('returns null for invalid input (URL)', () => {
        expect(parseCurie('https://example.com/path')).toBeNull();
    });

    it('returns null for plain string', () => {
        expect(parseCurie('not-a-curie')).toBeNull();
    });

    it('returns null for string with wrong number of segments', () => {
        expect(parseCurie('only:two')).toBeNull();
    });
});

describe('expandCurie', () => {
    const hubBaseUrl = 'http://hub.example.com';

    it('produces correct Hub URL with version', () => {
        const result = expandCurie('fae-calm:building-blocks:my-block@a1b2c3d', hubBaseUrl);
        expect(result).toBe('http://hub.example.com/calm/namespaces/fae-calm/building-blocks/my-block/versions/a1b2c3d');
    });

    it('produces correct Hub URL without version (no /versions/ suffix)', () => {
        const result = expandCurie('fae-calm:building-blocks:my-block', hubBaseUrl);
        expect(result).toBe('http://hub.example.com/calm/namespaces/fae-calm/building-blocks/my-block');
    });

    it('returns input unchanged if not a CURIE', () => {
        const url = 'https://other-service.com/resource';
        expect(expandCurie(url, hubBaseUrl)).toBe(url);
    });

    it('returns file path unchanged if not a CURIE', () => {
        const path = '/some/local/file.json';
        expect(expandCurie(path, hubBaseUrl)).toBe(path);
    });

    it('handles trailing slash in hubBaseUrl gracefully', () => {
        const result = expandCurie('ns:type:slug@v1', 'http://hub.example.com/');
        expect(result).toBe('http://hub.example.com//calm/namespaces/ns/type/slug/versions/v1');
    });
});
