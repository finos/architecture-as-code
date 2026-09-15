import { describe, it, expect, vi } from 'vitest';
import {
    ControlAssetService,
    LOCAL_DOMAIN,
} from './control-asset-service';
import { HubClient, HubApiError } from './hub-client';
import type { LocalControlDef } from './workspace-asset-service';

const localControls: LocalControlDef[] = [
    {
        id: 'micro-segmentation',
        controlId: 'security-001',
        name: 'Micro-segmentation',
        description: 'Prevent lateral movement',
        filePath: '/ws/controls/micro-segmentation.requirement.json',
        relativePath: 'controls/micro-segmentation.requirement.json',
    },
];

function mockHub(overrides: Partial<Record<keyof HubClient, unknown>> = {}): HubClient {
    return {
        getDomains: vi.fn().mockResolvedValue(['security', 'privacy']),
        getControlsForDomain: vi.fn(),
        ...overrides,
    } as unknown as HubClient;
}

describe('ControlAssetService.browse', () => {
    it('returns local controls plus empty Hub domain placeholders', async () => {
        const svc = new ControlAssetService(mockHub(), () => localControls);
        const groups = await svc.browse();

        expect(groups[0].domain).toBe(LOCAL_DOMAIN);
        expect(groups[0].controls).toEqual([
            {
                source: 'local',
                domain: LOCAL_DOMAIN,
                controlName: 'micro-segmentation',
                title: 'Micro-segmentation',
                description: 'Prevent lateral movement',
                requirementRef: 'controls/micro-segmentation.requirement.json',
            },
        ]);
        expect(groups.slice(1).map((g) => g.domain)).toEqual(['security', 'privacy']);
        expect(groups[1].controls).toEqual([]);
    });

    it('returns local controls only when no Hub client is present', async () => {
        const svc = new ControlAssetService(undefined, () => localControls);
        const groups = await svc.browse();
        expect(groups).toHaveLength(1);
        expect(groups[0].domain).toBe(LOCAL_DOMAIN);
    });

    it('still returns local controls when getDomains fails', async () => {
        const hub = mockHub({
            getDomains: vi.fn().mockRejectedValue(new Error('network')),
        });
        const svc = new ControlAssetService(hub, () => localControls);
        const groups = await svc.browse();
        expect(groups).toHaveLength(1);
        expect(groups[0].controls).toHaveLength(1);
    });
});

describe('ControlAssetService.browseControlsForDomain', () => {
    it('maps Hub control details into browse entries', async () => {
        const hub = mockHub({
            getControlsForDomain: vi.fn().mockResolvedValue([
                { id: 1, name: 'micro-segmentation', description: 'd', title: 'Micro Seg' },
                { id: 2, name: 'tls', description: 'TLS everywhere' },
            ]),
        });
        const svc = new ControlAssetService(hub, () => []);
        const group = await svc.browseControlsForDomain('security');

        expect(group.error).toBeUndefined();
        expect(group.controls).toEqual([
            {
                source: 'hub',
                domain: 'security',
                controlName: 'micro-segmentation',
                title: 'Micro Seg',
                description: 'd',
            },
            {
                source: 'hub',
                domain: 'security',
                controlName: 'tls',
                title: 'tls',
                description: 'TLS everywhere',
            },
        ]);
    });

    it('returns an error group on 403', async () => {
        const hub = mockHub({
            getControlsForDomain: vi
                .fn()
                .mockRejectedValue(new HubApiError(403, 'u', 'forbidden')),
        });
        const svc = new ControlAssetService(hub, () => []);
        const group = await svc.browseControlsForDomain('secret');
        expect(group.controls).toEqual([]);
        expect(group.error).toContain('403');
    });

    it('returns an error group when Hub is not connected', async () => {
        const svc = new ControlAssetService(undefined, () => []);
        const group = await svc.browseControlsForDomain('security');
        expect(group.error).toBe('Hub not connected');
    });

    it('reflects a freshly set Hub client', async () => {
        const svc = new ControlAssetService(undefined, () => []);
        const hub = mockHub({
            getControlsForDomain: vi.fn().mockResolvedValue([]),
        });
        svc.setHubClient(hub);
        const group = await svc.browseControlsForDomain('security');
        expect(group.error).toBeUndefined();
    });
});
