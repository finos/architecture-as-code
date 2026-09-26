import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useNamespaceTree } from './useNamespaceTree.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import type { NamespaceCounts } from '../../../model/counts.js';

const COLLAPSED_KEY = 'calmHub.railCollapsedNamespaces';

function nc(namespace: string, total: number): NamespaceCounts {
    return { namespace, architectures: 0, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total };
}

const namespaceCounts = [nc('finos', 10), nc('finos.calm', 5), nc('finos.wave', 3), nc('traderx', 9)];

describe('useNamespaceTree', () => {
    it('seeds the collapsed set from storage', () => {
        const storage = createMemoryStorage();
        storage.setItem(COLLAPSED_KEY, JSON.stringify(['finos']));

        const { result } = renderHook(() => useNamespaceTree({ namespaceCounts, needle: '', storage }));
        const finos = result.current.rows.find((r) => r.node.path === 'finos')!;
        expect(finos.collapsed).toBe(true);
        expect(result.current.rows.map((r) => r.node.path)).toEqual(['finos', 'traderx']);
    });

    it('toggle writes and unwrites the collapsed set', () => {
        const storage = createMemoryStorage();
        const { result } = renderHook(() => useNamespaceTree({ namespaceCounts, needle: '', storage }));

        act(() => result.current.toggleCollapsed('finos'));
        expect(JSON.parse(storage.getItem(COLLAPSED_KEY)!)).toEqual(['finos']);

        act(() => result.current.toggleCollapsed('finos'));
        expect(JSON.parse(storage.getItem(COLLAPSED_KEY)!)).toEqual([]);
    });

    it('degrades to fully expanded on corrupt storage, without throwing', () => {
        const storage = createMemoryStorage();
        storage.setItem(COLLAPSED_KEY, 'not-json{{{');

        expect(() => renderHook(() => useNamespaceTree({ namespaceCounts, needle: '', storage }))).not.toThrow();
        const { result } = renderHook(() => useNamespaceTree({ namespaceCounts, needle: '', storage }));
        expect(result.current.rows.every((r) => r.collapsed === false)).toBe(true);
    });

    it('degrades to fully expanded when storage throws, without throwing', () => {
        const throwingStorage: Storage = {
            getItem: () => {
                throw new Error('unavailable');
            },
            setItem: () => {
                throw new Error('unavailable');
            },
            removeItem: () => undefined,
            clear: () => undefined,
            key: () => null,
            length: 0,
        };

        expect(() => renderHook(() => useNamespaceTree({ namespaceCounts, needle: '', storage: throwingStorage }))).not.toThrow();
    });

    it('filtering writes nothing to storage — the stored value stays byte-identical', () => {
        const storage = createMemoryStorage();
        storage.setItem(COLLAPSED_KEY, JSON.stringify(['finos']));
        const before = storage.getItem(COLLAPSED_KEY);

        const { rerender } = renderHook(({ needle }) => useNamespaceTree({ namespaceCounts, needle, storage }), {
            initialProps: { needle: '' },
        });
        rerender({ needle: 'trade' });
        rerender({ needle: '' });

        expect(storage.getItem(COLLAPSED_KEY)).toBe(before);
    });

    it('filter mode ignores the collapsed set entirely', () => {
        const storage = createMemoryStorage();
        storage.setItem(COLLAPSED_KEY, JSON.stringify(['finos']));

        const { result } = renderHook(() => useNamespaceTree({ namespaceCounts, needle: 'wave', storage }));
        expect(result.current.filtering).toBe(true);
        expect(result.current.rows.map((r) => r.node.path)).toEqual(['finos', 'finos.wave']);
        expect(result.current.rows.every((r) => r.collapsed === false)).toBe(true);
    });

    it('navigating reveals the ancestors of the active namespace', () => {
        const storage = createMemoryStorage();
        storage.setItem(COLLAPSED_KEY, JSON.stringify(['finos']));

        const { result, rerender } = renderHook(
            ({ activeNamespace }) => useNamespaceTree({ namespaceCounts, needle: '', activeNamespace, storage }),
            { initialProps: { activeNamespace: undefined as string | undefined } }
        );
        expect(result.current.rows.map((r) => r.node.path)).toEqual(['finos', 'traderx']);

        rerender({ activeNamespace: 'finos.calm' });
        expect(result.current.rows.map((r) => r.node.path)).toEqual(['finos', 'finos.calm', 'finos.wave', 'traderx']);
        expect(JSON.parse(storage.getItem(COLLAPSED_KEY)!)).toEqual([]);
    });

    it('does not clear the saved collapsed set while namespaceCounts is still empty (loading window)', () => {
        const storage = createMemoryStorage();
        storage.setItem(COLLAPSED_KEY, JSON.stringify(['finos']));

        renderHook(() => useNamespaceTree({ namespaceCounts: [], needle: '', storage }));
        expect(JSON.parse(storage.getItem(COLLAPSED_KEY)!)).toEqual(['finos']);
    });
});
