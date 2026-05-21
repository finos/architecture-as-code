import { describe, it, expect, vi } from 'vitest';
import { fetchVersionList, fetchVersionData } from './compareData.js';
import { CalmService } from '../../../../service/calm-service.js';

function makeService() {
    return {
        fetchVersionsByCustomId: vi.fn().mockResolvedValue(['1.0.0']),
        fetchArchitectureVersions: vi.fn().mockResolvedValue(['2.0.0']),
        fetchPatternVersions: vi.fn().mockResolvedValue(['3.0.0']),
        fetchResourceByCustomId: vi.fn().mockResolvedValue({ id: 'slug' }),
        fetchArchitecture: vi.fn().mockResolvedValue({ id: 'arch' }),
        fetchPattern: vi.fn().mockResolvedValue({ id: 'pattern' }),
    } as unknown as CalmService & {
        fetchVersionsByCustomId: ReturnType<typeof vi.fn>;
        fetchArchitectureVersions: ReturnType<typeof vi.fn>;
        fetchPatternVersions: ReturnType<typeof vi.fn>;
        fetchResourceByCustomId: ReturnType<typeof vi.fn>;
        fetchArchitecture: ReturnType<typeof vi.fn>;
        fetchPattern: ReturnType<typeof vi.fn>;
    };
}

describe('fetchVersionList', () => {
    it('uses the custom-id endpoint for slug identifiers', async () => {
        const svc = makeService();
        await fetchVersionList(svc, 'ns', 'Architectures', 'my-arch');
        expect(svc.fetchVersionsByCustomId).toHaveBeenCalledWith('ns', 'my-arch');
        expect(svc.fetchArchitectureVersions).not.toHaveBeenCalled();
    });

    it('uses the architecture endpoint for numeric architecture ids', async () => {
        const svc = makeService();
        await fetchVersionList(svc, 'ns', 'Architectures', '42');
        expect(svc.fetchArchitectureVersions).toHaveBeenCalledWith('ns', '42');
    });

    it('uses the pattern endpoint for numeric pattern ids', async () => {
        const svc = makeService();
        await fetchVersionList(svc, 'ns', 'Patterns', '42');
        expect(svc.fetchPatternVersions).toHaveBeenCalledWith('ns', '42');
    });
});

describe('fetchVersionData', () => {
    it('uses the custom-id endpoint for slug identifiers, passing the type', async () => {
        const svc = makeService();
        await fetchVersionData(svc, 'ns', 'Architectures', 'my-arch', '1.0.0');
        expect(svc.fetchResourceByCustomId).toHaveBeenCalledWith('ns', 'my-arch', '1.0.0', 'Architectures');
    });

    it('uses the architecture endpoint for numeric architecture ids', async () => {
        const svc = makeService();
        await fetchVersionData(svc, 'ns', 'Architectures', '42', '1.0.0');
        expect(svc.fetchArchitecture).toHaveBeenCalledWith('ns', '42', '1.0.0');
    });

    it('uses the pattern endpoint for numeric pattern ids', async () => {
        const svc = makeService();
        await fetchVersionData(svc, 'ns', 'Patterns', '42', '1.0.0');
        expect(svc.fetchPattern).toHaveBeenCalledWith('ns', '42', '1.0.0');
    });
});
