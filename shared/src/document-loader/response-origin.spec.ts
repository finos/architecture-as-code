import { describe, it, expect } from 'vitest';
import { assertResponseOrigin } from './response-origin.js';
import { DocumentLoadError } from './document-loader.js';

const expectedOrigin = 'https://calm.finos.org';

describe('assertResponseOrigin', () => {
    it('passes when the response carries no request info (Node http adapter)', () => {
        expect(() => assertResponseOrigin({}, expectedOrigin, 'doc-1')).not.toThrow();
    });

    it('passes when request.responseURL matches the expected origin (XHR adapter)', () => {
        const response = { request: { responseURL: 'https://calm.finos.org/core.json' } };
        expect(() => assertResponseOrigin(response, expectedOrigin, 'doc-1')).not.toThrow();
    });

    it('passes when request.responseURL is a relative path (mocked/http adapter artifact)', () => {
        const response = { request: { responseURL: '/core.json' } };
        expect(() => assertResponseOrigin(response, expectedOrigin, 'doc-1')).not.toThrow();
    });

    it('throws a non-recoverable DocumentLoadError when responseURL is a different origin', () => {
        const response = { request: { responseURL: 'https://evil.example/x.json' } };
        expect(() => assertResponseOrigin(response, expectedOrigin, 'doc-1')).toThrow(DocumentLoadError);
        try {
            assertResponseOrigin(response, expectedOrigin, 'doc-1');
            throw new Error('expected assertResponseOrigin to throw');
        } catch (err) {
            expect(err).toBeInstanceOf(DocumentLoadError);
            expect((err as DocumentLoadError).recoverable).toBe(false);
            expect((err as DocumentLoadError).message).toContain('redirected to a different origin');
        }
    });

    it('throws when request.url (fetch-style) is a different origin and responseURL is absent', () => {
        const response = { request: { url: 'https://evil.example/x.json' } };
        expect(() => assertResponseOrigin(response, expectedOrigin, 'doc-1')).toThrow(DocumentLoadError);
    });

    it('passes when responseURL has a different host case than the expected origin', () => {
        const response = { request: { responseURL: 'https://CALM.FINOS.ORG/core.json' } };
        expect(() => assertResponseOrigin(response, expectedOrigin, 'doc-1')).not.toThrow();
    });

    it('prefers responseURL over url when both are present', () => {
        const response = { request: { responseURL: 'https://calm.finos.org/core.json', url: 'https://evil.example/x.json' } };
        expect(() => assertResponseOrigin(response, expectedOrigin, 'doc-1')).not.toThrow();
    });
});
