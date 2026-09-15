import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the pendingNodesRef emit pattern used in App.tsx.
 *
 * The pattern: when onNodeUpdate calls setNodes(fn), the functional updater
 * runs synchronously and captures the result in pendingNodesRef. The subsequent
 * emitChange reads from this ref (so it gets the updated nodes even though
 * React hasn't re-rendered), then clears it. Any other emit path falls back
 * to the store.
 */

interface EmitDeps {
    pendingNodesRef: { current: string[] | null };
    getStoreNodes: () => string[];
    emitted: string[][];
    generation: { current: number };
}

function createEmitLogic(deps: EmitDeps) {
    const debounceTimer: { current: ReturnType<typeof setTimeout> | null } = { current: null };

    function emitChange(immediate: boolean) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        const gen = deps.generation.current;

        const flush = () => {
            if (gen !== deps.generation.current) return;
            const nodes = deps.pendingNodesRef.current ?? deps.getStoreNodes();
            deps.pendingNodesRef.current = null;
            deps.emitted.push(nodes);
        };

        if (immediate) flush();
        else debounceTimer.current = setTimeout(flush, 300);
    }

    function onNodeUpdate(newNodes: string[], immediate: boolean) {
        deps.pendingNodesRef.current = newNodes;
        setTimeout(() => emitChange(immediate), 0);
    }

    function loadArchitecture() {
        deps.generation.current++;
        if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
        deps.pendingNodesRef.current = null;
    }

    return { emitChange, onNodeUpdate, loadArchitecture };
}

describe('pendingNodesRef emit pattern', () => {
    let deps: EmitDeps;

    beforeEach(() => {
        vi.useFakeTimers();
        deps = {
            pendingNodesRef: { current: null },
            getStoreNodes: () => ['stale-node-a', 'stale-node-b'],
            emitted: [],
            generation: { current: 0 },
        };
    });
    afterEach(() => { vi.useRealTimers(); });

    it('immediate emit reads from pendingNodesRef, not the store', () => {
        const { onNodeUpdate } = createEmitLogic(deps);

        onNodeUpdate(['updated-a', 'updated-b'], true);
        vi.advanceTimersByTime(0);

        expect(deps.emitted).toHaveLength(1);
        expect(deps.emitted[0]).toEqual(['updated-a', 'updated-b']);
    });

    it('clears pendingNodesRef after reading it', () => {
        const { onNodeUpdate } = createEmitLogic(deps);

        onNodeUpdate(['updated'], true);
        vi.advanceTimersByTime(0);

        expect(deps.pendingNodesRef.current).toBeNull();
    });

    it('falls back to store nodes when pendingNodesRef is null', () => {
        const { emitChange } = createEmitLogic(deps);

        emitChange(true);

        expect(deps.emitted).toHaveLength(1);
        expect(deps.emitted[0]).toEqual(['stale-node-a', 'stale-node-b']);
    });

    it('debounced emit (name/description) still reads pendingNodesRef', () => {
        const { onNodeUpdate } = createEmitLogic(deps);

        onNodeUpdate(['debounced-nodes'], false);
        vi.advanceTimersByTime(0);

        expect(deps.emitted).toHaveLength(0);

        vi.advanceTimersByTime(300);
        expect(deps.emitted).toHaveLength(1);
        expect(deps.emitted[0]).toEqual(['debounced-nodes']);
    });

    it('two rapid onNodeUpdate calls: second overwrites ref, first emit gets merged result', () => {
        deps.pendingNodesRef.current = ['call-1'];

        deps.pendingNodesRef.current = ['call-2-merged'];

        const { emitChange } = createEmitLogic(deps);
        emitChange(true);

        expect(deps.emitted[0]).toEqual(['call-2-merged']);
    });

    it('loadArchitecture clears pendingNodesRef so pending emit falls back to store', () => {
        const { onNodeUpdate, loadArchitecture } = createEmitLogic(deps);

        onNodeUpdate(['about-to-be-discarded'], true);

        loadArchitecture();

        expect(deps.pendingNodesRef.current).toBeNull();

        vi.advanceTimersByTime(0);

        // The emit still fires (setTimeout was already scheduled), but it reads
        // from the store (not the stale pending nodes) because the ref was cleared
        expect(deps.emitted).toHaveLength(1);
        expect(deps.emitted[0]).toEqual(['stale-node-a', 'stale-node-b']);
    });

    it('loadArchitecture cancels debounced emit timers', () => {
        const { emitChange, loadArchitecture } = createEmitLogic(deps);

        deps.pendingNodesRef.current = ['pending'];
        emitChange(false);

        loadArchitecture();

        vi.advanceTimersByTime(500);

        expect(deps.emitted).toHaveLength(0);
    });

    it('emit after loadArchitecture falls back to store (ref was cleared)', () => {
        const { loadArchitecture } = createEmitLogic(deps);

        deps.pendingNodesRef.current = ['stale-pending'];
        loadArchitecture();

        const freshDeps = { ...deps, generation: { current: deps.generation.current } };
        const fresh = createEmitLogic(freshDeps);
        fresh.emitChange(true);

        expect(freshDeps.emitted[0]).toEqual(['stale-node-a', 'stale-node-b']);
    });
});
