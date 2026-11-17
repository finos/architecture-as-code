import { DocumentLoadError } from './document-loader';
import { assertNoTraversal, isSafeRequestPath, unsafeRequestPathError } from './request-guards';

describe('request-guards', () => {
    describe('assertNoTraversal', () => {
        it.each([
            'https://calm.finos.org/calm/schemas/2025-03/meta/core.json',
            'calm:/schemas/2025-03/meta/core.json',
            'https://calm.finos.org/calm/schemas/v1.2/core.json',
            'https://calm.finos.org/calm/core.json#/%2E%2E',
            'https://calm.finos.org/calm/core.json?x=/..',
            'calm:/schemas/a\\..\\b.json',
            'calm:/schemas/..defaults.json',
            'https://calm.finos.org/calm/..meta.json',
            'https://calm.finos.org/calm/meta../core.json',
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
            'HTTPS://calm.finos.org/calm\\..\\secret.json',
            'calm:..',
            'calm:../admin/secrets.json',
            'calm:%2e%2e/admin/secrets.json',
            'calm:..#/defs',
            'calm:/schemas/sub/..?\u2028',
            'calm:/schemas/sub/..#\u2029',
            'https://calm.finos.org/calm/..',
            'https://calm.finos.org/calm/..?x=1',
            ' https://calm.finos.org/calm\\..\\secret.json',
            '\u0001https://calm.finos.org/calm\\..\\secret.json',
            'https://calm.finos.org/calm/..\u0001',
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

    describe('isSafeRequestPath and unsafeRequestPathError', () => {
        it.each([
            '/calm/schemas/2025-03/meta/core.json',
            '/schemas/2025-03/meta/core',
            '/a_b-c.d/e',
        ])('accepts an allowlisted path: %s', (path) => {
            expect(isSafeRequestPath(path)).toBe(true);
        });

        it.each([
            '/core.json;evil',
            '/schemas/%00malicious',
            '/schemas/a b.json',
            '/schemas/a%2fb.json',
        ])('rejects a path with disallowed characters: %s', (path) => {
            expect(isSafeRequestPath(path)).toBe(false);
            const error = unsafeRequestPathError(path, 'Test loader');
            expect(error).toBeInstanceOf(DocumentLoadError);
            expect(error).toMatchObject({ recoverable: false });
            expect(error.message)
                .toBe(`Test loader rejected a path with disallowed characters: ${path}`);
        });

        it.each([
            '',
            '..',
            '../admin/secrets.json',
            'schemas/core.json',
            '//evil.example/x',
        ])('rejects a path that does not start with a single "/": %s', (path) => {
            expect(isSafeRequestPath(path)).toBe(false);
            const error = unsafeRequestPathError(path, 'Test loader');
            expect(error).toBeInstanceOf(DocumentLoadError);
            expect(error).toMatchObject({ recoverable: false });
            expect(error.message)
                .toBe(`Test loader rejected a path that does not start with a single '/': ${path}`);
        });
    });
});
