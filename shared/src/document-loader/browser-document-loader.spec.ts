import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    inMemory: vi.fn(function () { return { kind: 'memory', initialise: vi.fn(), loadMissingDocument: vi.fn(), resolvePath: vi.fn() }; }),
    calmHub: vi.fn(function () { return { kind: 'hub', initialise: vi.fn(), loadMissingDocument: vi.fn(), resolvePath: vi.fn() }; }),
    directUrl: vi.fn(function () { return { kind: 'url', initialise: vi.fn(), loadMissingDocument: vi.fn(), resolvePath: vi.fn() }; }),
    multi: vi.fn(function (loaders: unknown[]) { return { kind: 'multi', loaders }; }),
}));

vi.mock('./in-memory-document-loader', () => ({ InMemoryDocumentLoader: mocks.inMemory }));
vi.mock('./calmhub-document-loader', () => ({ CalmHubDocumentLoader: mocks.calmHub }));
vi.mock('./direct-url-document-loader', () => ({ DirectUrlDocumentLoader: mocks.directUrl }));
vi.mock('./multi-strategy-document-loader', () => ({ MultiStrategyDocumentLoader: mocks.multi }));

import { buildBrowserDocumentLoader } from './browser-document-loader';

describe('buildBrowserDocumentLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('composes in-memory then direct-url by default', () => {
        const docs = { 'https://x/a.json': {} };
        const loader = buildBrowserDocumentLoader({ documents: docs }) as unknown as { loaders: { kind: string }[] };
        expect(mocks.inMemory).toHaveBeenCalledWith(docs, false);
        expect(mocks.calmHub).not.toHaveBeenCalled();
        expect(mocks.directUrl).toHaveBeenCalledWith(false, undefined, undefined);
        expect(loader.loaders.map((l) => l.kind)).toEqual(['memory', 'url']);
    });

    it('inserts a CalmHub loader between memory and url when a hub url is given', () => {
        const authPlugin = { getAuthHeaders: vi.fn() };
        const loader = buildBrowserDocumentLoader({
            documents: {}, calmHubUrl: 'https://hub', authPlugin: authPlugin as never, allowedRemoteHosts: ['calm.finos.org'], debug: true,
        }) as unknown as { loaders: { kind: string }[] };
        expect(mocks.calmHub).toHaveBeenCalledWith('https://hub', true, authPlugin);
        expect(mocks.directUrl).toHaveBeenCalledWith(true, undefined, ['calm.finos.org']);
        expect(loader.loaders.map((l) => l.kind)).toEqual(['memory', 'hub', 'url']);
    });

    it('omits the direct-url loader when allowRemote is false', () => {
        const loader = buildBrowserDocumentLoader({ documents: {}, allowRemote: false }) as unknown as { loaders: { kind: string }[] };
        expect(mocks.directUrl).not.toHaveBeenCalled();
        expect(loader.loaders.map((l) => l.kind)).toEqual(['memory']);
    });
});
