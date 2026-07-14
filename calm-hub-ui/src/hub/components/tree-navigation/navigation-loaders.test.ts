import { describe, it, expect, vi } from 'vitest';
import { loadResource, loadResourceForId, resolveResourceDetailPath } from './navigation-loaders.js';
import { CalmService } from '../../../service/calm-service.js';
import { AdrService } from '../../../service/adr-service/adr-service.js';

describe('resolveResourceDetailPath', () => {
    it('returns the /detail pseudo-version path for interfaces without touching version APIs', async () => {
        const calmService = {} as CalmService;
        const adrService = {} as AdrService;

        const path = await resolveResourceDetailPath('7', 'Interfaces', 'traderx', calmService, adrService);

        expect(path).toBe('/traderx/interfaces/7/detail');
    });

    it('resolves the latest version path for a versioned resource', async () => {
        const calmService = {
            fetchArchitectureVersions: vi.fn().mockResolvedValue(['1.0.0', '2.0.0', '1.5.0']),
        } as unknown as CalmService;
        const adrService = {} as AdrService;

        const path = await resolveResourceDetailPath('1', 'Architectures', 'traderx', calmService, adrService);

        expect(path).toBe('/traderx/architectures/1/2.0.0');
    });

    it('returns null when no versions are found', async () => {
        const calmService = {
            fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
        } as unknown as CalmService;
        const adrService = {} as AdrService;

        const path = await resolveResourceDetailPath('1', 'Architectures', 'traderx', calmService, adrService);

        expect(path).toBeNull();
    });
});

describe('loadResource error handling', () => {
    it('invokes onError when the architecture fetch rejects', async () => {
        const error = new Error('404');
        const calmService = {
            fetchArchitecture: vi.fn().mockRejectedValue(error),
        } as unknown as CalmService;
        const adrService = {} as AdrService;
        const onDataLoad = vi.fn();
        const onError = vi.fn();

        loadResource({
            version: '1.0.0',
            type: 'Architectures',
            namespace: 'finos',
            resourceID: '1',
            calmService,
            onDataLoad,
            onAdrLoad: vi.fn(),
            adrService,
            onError,
        });
        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
        expect(onDataLoad).not.toHaveBeenCalled();
    });

    it('does not reject unhandled when the fetch rejects and no onError is given', async () => {
        const calmService = {
            fetchPattern: vi.fn().mockRejectedValue(new Error('404')),
        } as unknown as CalmService;

        loadResource({
            version: '1.0.0',
            type: 'Patterns',
            namespace: 'finos',
            resourceID: '1',
            calmService,
            onDataLoad: vi.fn(),
            onAdrLoad: vi.fn(),
            adrService: {} as AdrService,
        });
        // Flush the rejection; an unhandled rejection would fail the test run.
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
});

describe('loadResourceForId error handling', () => {
    it('invokes onError when the custom-id fetch rejects', async () => {
        const error = new Error('404');
        const calmService = {
            fetchResourceByCustomId: vi.fn().mockRejectedValue(error),
        } as unknown as CalmService;
        const onDataLoad = vi.fn();
        const onError = vi.fn();

        loadResourceForId('1.0.0', 'Architectures', 'finos', 'model-registry', calmService, onDataLoad, onError);

        await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
        expect(onDataLoad).not.toHaveBeenCalled();
    });
});
