import { DocumentLoadError } from './document-loader';
import { assertNoTraversal, assertSafeRequestPath } from './request-guards';

describe('request-guards', () => {
    describe('assertNoTraversal', () => {
        it.each([
            'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'calm:/schemas/2025-03/meta/core.json',
            'https://calm.finos.org/calm/schemas/v1.2/core.json',
        ])('accepts a path without traversal: %s', (documentId) => {
            expect(() => assertNoTraversal(documentId, 'Test loader')).not.toThrow();
        });

        it.each([
            'https://calm.finos.org/calm/../secret.json',
            'https://calm.finos.org/calm/%2e%2e/secret.json',
            'https://calm.finos.org/calm/%2E%2E/secret.json',
            'https://calm.finos.org/calm/.%2e/secret.json',
            'https://calm.finos.org/calm/%2e./secret.json',
            'https://calm.finos.org/calm\\..\\secret.json',
            'https://calm.finos.org/calm/.\t./secret.json',
            'https://calm.finos.org/calm/.\r\n./secret.json',
        ])('rejects traversal, including forms the URL parser resolves to "..": %s', (documentId) => {
            let thrown: unknown;
            try {
                assertNoTraversal(documentId, 'Test loader');
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(DocumentLoadError);
            expect(thrown).toMatchObject({ recoverable: false });
            expect((thrown as Error).message)
                .toBe(`Test loader rejected a path containing directory traversal: ${documentId}`);
        });
    });

    describe('assertSafeRequestPath', () => {
        it.each([
            '/calm/schemas/2025-03/meta/core.json',
            '/schemas/2025-03/meta/core',
            '/a_b-c.d/e',
        ])('accepts an allowlisted path: %s', (path) => {
            expect(() => assertSafeRequestPath(path, 'Test loader')).not.toThrow();
        });

        it.each([
            '/core.json;evil',
            '/schemas/%00malicious',
            '/schemas/a b.json',
            '/schemas/a%2fb.json',
            '',
        ])('rejects a path with disallowed characters: %s', (path) => {
            let thrown: unknown;
            try {
                assertSafeRequestPath(path, 'Test loader');
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(DocumentLoadError);
            expect(thrown).toMatchObject({ recoverable: false });
            expect((thrown as Error).message)
                .toBe(`Test loader rejected a path with disallowed characters: ${path}`);
        });
    });
});
