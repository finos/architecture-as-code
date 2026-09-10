import { describe, it, expect } from 'vitest';
import { parseCurie } from './canvas-panel';

describe('parseCurie', () => {
    it('parses a standard CURIE with namespace, type, slug, and version', () => {
        const result = parseCurie('finos:building-blocks:microservice@abc123');
        expect(result).toEqual({
            namespace: 'finos',
            type: 'building-blocks',
            slug: 'microservice',
            version: 'abc123',
        });
    });

    it('parses a CURIE without a version', () => {
        const result = parseCurie('finos:building-blocks:microservice');
        expect(result).toEqual({
            namespace: 'finos',
            type: 'building-blocks',
            slug: 'microservice',
            version: undefined,
        });
    });

    it('handles a SHA-style version', () => {
        const result = parseCurie(
            'acme-corp:building-blocks:api-gateway@sha256:deadbeef'
        );
        expect(result).toEqual({
            namespace: 'acme-corp',
            type: 'building-blocks',
            slug: 'api-gateway',
            version: 'sha256:deadbeef',
        });
    });

    it('handles empty parts gracefully', () => {
        const result = parseCurie('::');
        expect(result).toEqual({
            namespace: '',
            type: '',
            slug: '',
            version: undefined,
        });
    });

    it('extracts version from slug@version format', () => {
        const result = parseCurie('ns:type:my-slug@v1.2.3');
        expect(result).toEqual({
            namespace: 'ns',
            type: 'type',
            slug: 'my-slug',
            version: 'v1.2.3',
        });
    });
});
