import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCatalogueHighlights } from './useCatalogueHighlights.js';
import { CalmService } from '../../../service/calm-service.js';
import type { NamespaceCounts } from '../../../model/counts.js';
import type { ResourceSummary } from '../../../model/calm.js';

const counts = (over: Partial<NamespaceCounts>): NamespaceCounts => ({
    namespace: 'ns',
    architectures: 0,
    patterns: 0,
    flows: 0,
    standards: 0,
    adrs: 0,
    interfaces: 0,
    total: 0,
    ...over,
});

const summary = (id: number, name: string): ResourceSummary => ({ id, name, description: `${name} desc` });

function mockService(
    archFn: (ns: string) => Promise<ResourceSummary[]>,
    patternFn: (ns: string) => Promise<ResourceSummary[]> = async () => []
): CalmService {
    return {
        fetchArchitectureSummaries: vi.fn(archFn),
        fetchPatternSummaries: vi.fn(patternFn),
    } as unknown as CalmService;
}

describe('useCatalogueHighlights', () => {
    it('fetches architecture and pattern summaries for namespaces with content, bounded to two', async () => {
        const arch = vi.fn(async (ns: string) => [summary(1, `${ns}-arch`)]);
        const pattern = vi.fn(async (ns: string) => [summary(2, `${ns}-pattern`)]);
        const service = {
            fetchArchitectureSummaries: arch,
            fetchPatternSummaries: pattern,
        } as unknown as CalmService;
        const namespaceCounts: NamespaceCounts[] = [
            counts({ namespace: 'a', architectures: 2 }),
            counts({ namespace: 'b', architectures: 0, patterns: 0 }), // skipped (no content)
            counts({ namespace: 'c', patterns: 1 }), // qualifies via patterns
            counts({ namespace: 'd', architectures: 5 }), // beyond the cap of 2
        ];

        const { result } = renderHook(() => useCatalogueHighlights(namespaceCounts, service));
        await waitFor(() => expect(result.current.loading).toBe(false));

        // Only the first two namespaces WITH content (a, c) are probed, for BOTH types.
        expect(arch).toHaveBeenCalledTimes(2);
        expect(pattern).toHaveBeenCalledTimes(2);
        expect(arch).toHaveBeenCalledWith('a');
        expect(pattern).toHaveBeenCalledWith('c');
        expect(arch).not.toHaveBeenCalledWith('b');
        expect(arch).not.toHaveBeenCalledWith('d');
    });

    it('tags highlights with their true type, spanning architectures and patterns', async () => {
        const service = mockService(
            async (ns) => [summary(1, `${ns}-arch`)],
            async (ns) => [summary(2, `${ns}-pattern`)]
        );
        const namespaceCounts: NamespaceCounts[] = [
            counts({ namespace: 'a', architectures: 1, patterns: 1 }),
        ];

        const { result } = renderHook(() => useCatalogueHighlights(namespaceCounts, service));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.highlights).toEqual([
            expect.objectContaining({ namespace: 'a', name: 'a-arch', type: 'Architectures' }),
            expect.objectContaining({ namespace: 'a', name: 'a-pattern', type: 'Patterns' }),
        ]);
    });

    it('returns at most three real highlights with their namespace', async () => {
        const service = mockService(async (ns) => [
            summary(1, `${ns}-1`),
            summary(2, `${ns}-2`),
        ]);
        const namespaceCounts: NamespaceCounts[] = [
            counts({ namespace: 'a', architectures: 2 }),
            counts({ namespace: 'c', architectures: 2 }),
        ];

        const { result } = renderHook(() => useCatalogueHighlights(namespaceCounts, service));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.highlights).toHaveLength(3);
        expect(result.current.highlights[0]).toMatchObject({
            namespace: 'a',
            name: 'a-1',
            type: 'Architectures',
        });
        expect(result.current.highlights.every((h) => h.namespace)).toBe(true);
    });

    it('does not fetch and reports loaded when no namespace has architectures or patterns', async () => {
        const arch = vi.fn(async () => []);
        const pattern = vi.fn(async () => []);
        const service = {
            fetchArchitectureSummaries: arch,
            fetchPatternSummaries: pattern,
        } as unknown as CalmService;
        const namespaceCounts: NamespaceCounts[] = [
            counts({ namespace: 'a', architectures: 0, patterns: 0 }),
        ];

        const { result } = renderHook(() => useCatalogueHighlights(namespaceCounts, service));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(arch).not.toHaveBeenCalled();
        expect(pattern).not.toHaveBeenCalled();
        expect(result.current.highlights).toEqual([]);
    });

    it('tolerates a failing summary fetch (returns the rest)', async () => {
        const service = mockService(async (ns) => {
            if (ns === 'a') throw new Error('boom');
            return [summary(1, `${ns}-ok`)];
        });
        const namespaceCounts: NamespaceCounts[] = [
            counts({ namespace: 'a', architectures: 2 }),
            counts({ namespace: 'c', architectures: 2 }),
        ];

        const { result } = renderHook(() => useCatalogueHighlights(namespaceCounts, service));
        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.highlights).toEqual([
            expect.objectContaining({ namespace: 'c', name: 'c-ok', type: 'Architectures' }),
        ]);
    });
});
