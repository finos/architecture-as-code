import { describe, it, expect } from 'vitest';
import { parseCurie, pinControlCuries } from './canvas-panel';

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

describe('pinControlCuries', () => {
    const pin = (url: string) =>
        pinControlCuries(
            { c: { requirements: [{ 'requirement-url': url }] } },
            'sha123'
        ).c as { requirements: Array<{ 'requirement-url': string }> };

    it('pins an unversioned building-block CURIE with the parent SHA', () => {
        expect(pin('finos:building-blocks:svc').requirements[0]['requirement-url']).toBe(
            'finos:building-blocks:svc@sha123'
        );
    });

    it('never pins a control CURIE (control versions are independent)', () => {
        // An unversioned control CURIE has 2 colons and would otherwise be pinned.
        expect(pin('security:controls:micro-segmentation').requirements[0]['requirement-url']).toBe(
            'security:controls:micro-segmentation'
        );
    });

    it('leaves an already-versioned control CURIE untouched', () => {
        expect(pin('security:controls:x@1.0.0').requirements[0]['requirement-url']).toBe(
            'security:controls:x@1.0.0'
        );
    });

    it('leaves a non-CURIE (local path) untouched', () => {
        expect(pin('controls/x.requirement.json').requirements[0]['requirement-url']).toBe(
            'controls/x.requirement.json'
        );
    });

    it('preserves controls with no requirements', () => {
        const result = pinControlCuries({ c: { description: 'x' } }, 'sha');
        expect(result.c).toEqual({ description: 'x' });
    });
});
