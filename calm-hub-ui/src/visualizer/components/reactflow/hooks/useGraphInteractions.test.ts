import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Node, NodeChange } from 'reactflow';
import { useGraphInteractions } from './useGraphInteractions.js';
import { saveNodePositions } from '../../../services/node-position-service.js';

vi.mock('../../../services/node-position-service.js', () => ({
    saveNodePositions: vi.fn(),
}));

// reflowContainersToFitChildren returns the nodes as-is for these tests; we only
// care about whether persistence is triggered, not the geometry.
vi.mock('../utils/layoutUtils.js', () => ({
    reflowContainersToFitChildren: (nodes: Node[]) => nodes,
}));

const currentNodes: Node[] = [{ id: 'a', position: { x: 10, y: 20 }, data: {} }];

// A setNodes mock that immediately invokes the updater with `currentNodes`, so
// the side effect inside the updater runs synchronously during the test.
function makeSetNodes() {
    return vi.fn((updater: (nodes: Node[]) => Node[]) => updater(currentNodes));
}

function setup(persistKey?: string) {
    const setNodes = makeSetNodes();
    const onNodesChangeBase = vi.fn();
    const { result } = renderHook(() =>
        useGraphInteractions({
            setNodes,
            onNodesChangeBase,
            groupNodeTypes: ['group'],
            persistKey,
        })
    );
    return { result, setNodes, onNodesChangeBase };
}

const dragEnd: NodeChange = { id: 'a', type: 'position', dragging: false };
const dragging: NodeChange = { id: 'a', type: 'position', dragging: true };

describe('useGraphInteractions persistence', () => {
    beforeEach(() => vi.clearAllMocks());

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
});
