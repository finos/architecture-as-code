import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Node, NodeChange } from 'reactflow';
import { useGraphInteractions } from './useGraphInteractions.js';
import { saveNodePositions } from '../../../services/node-position-service.js';
import { reflowContainersToFitChildren } from '../utils/layoutUtils.js';

vi.mock('../../../services/node-position-service.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../services/node-position-service.js')>();
    return {
        ...actual,
        // toStoredPositions stays real: onPositionsChange assertions below rely on it.
        saveNodePositions: vi.fn(),
    };
});

// reflowContainersToFitChildren returns the nodes as-is for these tests; we only
// care about whether persistence is triggered, not the geometry, except in the
// dedicated "post-reflow positions" test below, which overrides this per-call.
vi.mock('../utils/layoutUtils.js', () => ({
    reflowContainersToFitChildren: vi.fn((nodes: Node[]) => nodes),
}));

const currentNodes: Node[] = [{ id: 'a', position: { x: 10, y: 20 }, data: {} }];

// A setNodes mock that immediately invokes the updater with `currentNodes`, so
// the side effect inside the updater runs synchronously during the test.
function makeSetNodes() {
    return vi.fn((updater: (nodes: Node[]) => Node[]) => updater(currentNodes));
}

function setup(persistKey?: string, onPositionsChange?: (positions: unknown) => void) {
    const setNodes = makeSetNodes();
    const onNodesChangeBase = vi.fn();
    const { result } = renderHook(() =>
        useGraphInteractions({
            setNodes,
            onNodesChangeBase,
            groupNodeTypes: ['group'],
            persistKey,
            onPositionsChange,
        })
    );
    return { result, setNodes, onNodesChangeBase };
}

const dragEnd: NodeChange = { id: 'a', type: 'position', dragging: false };
const dragging: NodeChange = { id: 'a', type: 'position', dragging: true };

describe('useGraphInteractions persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(reflowContainersToFitChildren).mockImplementation((nodes: Node[]) => nodes);
    });

    it('always forwards changes to the base handler', () => {
        const { result, onNodesChangeBase } = setup('ns/id');
        result.current.onNodesChange([dragEnd]);
        expect(onNodesChangeBase).toHaveBeenCalledWith([dragEnd]);
    });

    it('persists positions on drag-end when a persistKey is provided', () => {
        const { result } = setup('ns/id');
        result.current.onNodesChange([dragEnd]);
        expect(saveNodePositions).toHaveBeenCalledWith('ns/id', currentNodes);
    });

    it('persists the post-reflow positions, not the pre-reflow ones', () => {
        // Unlike the identity stub above, this genuinely transforms the nodes —
        // catching a regression where the code persists `currentNodes` (the
        // updater's input) instead of `reflowed` (reflow's output). The default
        // identity mock can't catch this: reflowed === currentNodes by
        // reference there, so a `toHaveBeenCalledWith(key, currentNodes)`
        // assertion would pass either way.
        const reflowedNodes: Node[] = [{ id: 'a', position: { x: 999, y: 888 }, data: {} }];
        vi.mocked(reflowContainersToFitChildren).mockReturnValue(reflowedNodes);

        const { result } = setup('ns/id');
        result.current.onNodesChange([dragEnd]);

        expect(saveNodePositions).toHaveBeenCalledWith('ns/id', reflowedNodes);
        expect(saveNodePositions).not.toHaveBeenCalledWith('ns/id', currentNodes);
    });

    it('does not persist mid-drag (dragging still true)', () => {
        const { result } = setup('ns/id');
        result.current.onNodesChange([dragging]);
        expect(saveNodePositions).not.toHaveBeenCalled();
    });

    it('does not persist when no persistKey is provided', () => {
        const { result } = setup(undefined);
        result.current.onNodesChange([dragEnd]);
        expect(saveNodePositions).not.toHaveBeenCalled();
    });

    describe('onPositionsChange', () => {
        it('reports the post-reflow positions at drag-end', () => {
            const reflowedNodes: Node[] = [{ id: 'a', position: { x: 999, y: 888 }, data: {} }];
            vi.mocked(reflowContainersToFitChildren).mockReturnValue(reflowedNodes);
            const onPositionsChange = vi.fn();

            const { result } = setup('ns/id', onPositionsChange);
            result.current.onNodesChange([dragEnd]);

            expect(onPositionsChange).toHaveBeenCalledWith([{ id: 'a', position: { x: 999, y: 888 } }]);
        });

        it('does not report mid-drag', () => {
            const onPositionsChange = vi.fn();
            const { result } = setup('ns/id', onPositionsChange);
            result.current.onNodesChange([dragging]);
            expect(onPositionsChange).not.toHaveBeenCalled();
        });

        it('reports even without a persistKey (report and persist are independent)', () => {
            const onPositionsChange = vi.fn();
            const { result } = setup(undefined, onPositionsChange);
            result.current.onNodesChange([dragEnd]);
            expect(onPositionsChange).toHaveBeenCalled();
            expect(saveNodePositions).not.toHaveBeenCalled();
        });
    });
});
