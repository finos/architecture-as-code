import { describe, it, expect, vi } from 'vitest';
import { resolveResourceDetailPath } from './navigation-loaders.js';
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
