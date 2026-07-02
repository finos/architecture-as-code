import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNamespaceItems } from './useNamespaceItems.js';

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () {
        return {
            fetchArchitectureSummaries: vi
                .fn()
                .mockResolvedValue([
                    { id: 1, name: 'Arch One', description: 'First architecture', customId: 'arch-one' },
                ]),
            fetchPatternSummaries: vi.fn().mockResolvedValue([]),
            fetchFlowSummaries: vi.fn().mockResolvedValue([]),
            fetchStandardSummaries: vi.fn().mockResolvedValue([]),
        };
    }),
}));

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () {
        return {
            fetchInterfacesForNamespace: vi
                .fn()
                .mockResolvedValue([{ id: 7, name: 'My Interface', description: 'A port' }]),
        };
    }),
}));

vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(function () {
        return {
            fetchAdrSummaries: vi.fn().mockResolvedValue([{ id: 3, title: 'Pick a DB', status: 'accepted' }]),
        };
    }),
}));

describe('useNamespaceItems', () => {
    beforeEach(() => vi.clearAllMocks());

    it('carries each item description and customId from the summary', async () => {
        const { result } = renderHook(() => useNamespaceItems('traderx'));
        await waitFor(() => expect(result.current.loading).toBe(false));

        const arch = result.current.groups.find((g) => g.type === 'Architectures');
        expect(arch?.items[0]).toMatchObject({
            id: 'arch-one',
            name: 'Arch One',
            description: 'First architecture',
            customId: 'arch-one',
        });
    });

    it('groups every resource type in display order', async () => {
        const { result } = renderHook(() => useNamespaceItems('traderx'));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.groups.map((g) => g.type)).toEqual([
            'Architectures',
            'Patterns',
            'Flows',
            'Standards',
            'ADRs',
            'Interfaces',
        ]);
    });

    it('labels ADRs with title and status, and keeps numeric interface ids', async () => {
        const { result } = renderHook(() => useNamespaceItems('traderx'));
        await waitFor(() => expect(result.current.loading).toBe(false));

        const adrs = result.current.groups.find((g) => g.type === 'ADRs');
        expect(adrs?.items[0]).toMatchObject({ id: '3', name: 'Pick a DB (accepted)' });

        const interfaces = result.current.groups.find((g) => g.type === 'Interfaces');
        expect(interfaces?.items[0]).toMatchObject({
            id: '7',
            name: 'My Interface',
            description: 'A port',
        });
    });
});
