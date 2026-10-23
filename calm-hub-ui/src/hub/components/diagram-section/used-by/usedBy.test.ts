import { describe, it, expect } from 'vitest';
import { architectureHref, usedByLabel } from './usedBy.js';

describe('usedByLabel', () => {
    it('shows no number until the list has loaded', () => {
        expect(usedByLabel({ status: 'idle' })).toBe('Used by');
        expect(usedByLabel({ status: 'loading' })).toBe('Used by');
        expect(usedByLabel({ status: 'error' })).toBe('Used by');
    });

    it('counts architectures, not their versions', () => {
        expect(
            usedByLabel({
                status: 'loaded',
                implementations: [
                    { namespace: 'finos', architectureId: 7, version: '1.0.0' },
                    { namespace: 'finos', architectureId: 7, version: '1.1.0' },
                    { namespace: 'other', architectureId: 7, version: '1.0.0' },
                ],
            })
        ).toBe('Used by (2)');
    });
});

describe('architectureHref', () => {
    it('encodes each segment of the link', () => {
        expect(architectureHref({ namespace: 'a b', architectureId: 1, version: '1.0.0', customId: 'x/y' })).toBe(
            '#/a%20b/architectures/x%2Fy/1.0.0'
        );
    });
});
