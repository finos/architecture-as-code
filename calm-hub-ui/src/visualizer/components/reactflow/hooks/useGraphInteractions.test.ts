import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook } from '@testing-library/react';
import { createElement, useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNodesState } from '@xyflow/react';
import type { Node, NodeChange } from '@xyflow/react';
import { useGraphInteractions } from './useGraphInteractions.js';
import { saveNodePositions, toStoredPositions, type StoredNodePosition } from '../../../services/node-position-service.js';
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

// The viewer's own diagram settings change the measured card sizes.
const viewSettings = { scale: 1, presenting: false };
vi.mock('../../../../theme/useDiagramTextScale.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../theme/useDiagramTextScale.js')>()),
    useDiagramTextScale: () => ({ scale: viewSettings.scale }),
}));
vi.mock('../../../../theme/usePresentationMode.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../../theme/usePresentationMode.js')>()),
    usePresentationMode: () => ({ presenting: viewSettings.presenting }),
}));

const currentNodes: Node[] = [{ id: 'a', position: { x: 10, y: 20 }, data: {} }];

// A setNodes mock that immediately invokes the updater with `currentNodes`, so
// the side effect inside the updater runs synchronously during the test.
function makeSetNodes() {
    return vi.fn((updater: (nodes: Node[]) => Node[]) => updater(currentNodes));
}

function setup(persistKey?: string, onPositionsChange?: (positions: StoredNodePosition[]) => void) {
    const setNodes = makeSetNodes();
    const onNodesChangeBase = vi.fn();
    const { result } = renderHook(() =>
        useGraphInteractions({
            nodes: currentNodes,
            setNodes: setNodes as unknown as React.Dispatch<React.SetStateAction<Node[]>>,
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

    describe('with the viewer\'s own diagram settings', () => {
        const sized = [{ id: 'a', type: 'custom', position: { x: 10, y: 20 }, data: {}, width: 220, height: 130, measured: { width: 220, height: 130 } }] as Node[];

        afterEach(() => {
            viewSettings.scale = 1;
            viewSettings.presenting = false;
        });

        it('keeps the measured sizes at 100% text size outside presentation mode', () => {
            vi.mocked(reflowContainersToFitChildren).mockImplementation(() => sized);
            const onPositionsChange = vi.fn();
            const { result } = setup('ns/id', onPositionsChange);
            result.current.onNodesChange([dragEnd]);
            expect(saveNodePositions).toHaveBeenCalledWith('ns/id', sized);
        });

        it.each([
            ['another text size', { scale: 2, presenting: false }],
            ['presentation mode', { scale: 1, presenting: true }],
            ['a smaller text size', { scale: 0.7, presenting: false }],
        ])('at %s, drops the measured sizes and fits the containers to the standard node size again', (_case, settings) => {
            Object.assign(viewSettings, settings);
            // The drag's own reflow sees the measured sizes; the second one gets nodes without them.
            vi.mocked(reflowContainersToFitChildren).mockImplementationOnce(() => sized);
            const { result } = setup('ns/id');
            result.current.onNodesChange([dragEnd]);

            expect(reflowContainersToFitChildren).toHaveBeenCalledTimes(2);
            const refitted = vi.mocked(reflowContainersToFitChildren).mock.calls[1][0];
            expect(refitted).toEqual([expect.objectContaining({ id: 'a', position: { x: 10, y: 20 } })]);
            expect(refitted[0].width).toBeUndefined();
            expect(refitted[0].height).toBeUndefined();
            expect(refitted[0].measured).toBeUndefined();
            expect(saveNodePositions).toHaveBeenCalledWith('ns/id', refitted);
        });

        it('keeps container sizes, fitted to the standard node size, so new children are still placed below their siblings', async () => {
            const actual = await vi.importActual<typeof import('../utils/layoutUtils.js')>('../utils/layoutUtils.js');
            vi.mocked(reflowContainersToFitChildren).mockImplementation(actual.reflowContainersToFitChildren);
            viewSettings.scale = 2;
            const measured = [
                { id: 'sys', type: 'group', position: { x: 0, y: 0 }, data: {}, width: 600, height: 500 },
                { id: 'a', type: 'custom', position: { x: 80, y: 80 }, data: {}, parentId: 'sys', measured: { width: 220, height: 300 } },
                { id: 'empty', type: 'group', position: { x: 700, y: 0 }, data: {}, width: 600, height: 400 },
            ] as Node[];
            const setNodes = vi.fn((updater: (nodes: Node[]) => Node[]) => updater(measured));
            const { result } = renderHook(() =>
                useGraphInteractions({
                    nodes: measured,
                    setNodes: setNodes as unknown as React.Dispatch<React.SetStateAction<Node[]>>,
                    onNodesChangeBase: vi.fn(),
                    groupNodeTypes: ['group'],
                    persistKey: 'ns/id',
                })
            );

            result.current.onNodesChange([dragEnd]);

            const saved = toStoredPositions(vi.mocked(saveNodePositions).mock.calls[0][1]);
            expect(saved).toEqual([
                { id: 'sys', position: { x: 0, y: 0 }, width: 410, height: 260 },
                { id: 'a', position: { x: 80, y: 80 } },
                // A container with no children has no reflow to size it, so it keeps its size.
                { id: 'empty', position: { x: 700, y: 0 }, width: 600, height: 400 },
            ]);
        });
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

});

// #3503: the report hands positions to DiagramSection, which sets its own state,
// so it must run outside the state updater React executes while rendering.
// These use the real useNodesState wiring the graphs use: a setNodes mock that
// invokes the updater itself leaves nothing queued before setNodes, so the
// updater runs eagerly and the test covers a path the app never takes.
describe('useGraphInteractions reporting (real state)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(reflowContainersToFitChildren).mockImplementation((nodes: Node[]) => nodes);
    });

    function renderHarness(props: {
        onPositionsChange?: (positions: StoredNodePosition[]) => void;
        persistKey?: string;
    }) {
        const api: { current: ReturnType<typeof useGraphInteractions> | null } = { current: null };

        function Harness() {
            const [nodes, setNodes, onNodesChangeBase] = useNodesState(currentNodes);
            api.current = useGraphInteractions({
                nodes,
                setNodes,
                onNodesChangeBase,
                groupNodeTypes: ['group'],
                persistKey: props.persistKey,
                onPositionsChange: props.onPositionsChange,
            });
            return null;
        }

        render(createElement(Harness));
        return api;
    }

    it('reports the reflowed positions once, after the commit', async () => {
        const reflowedNodes: Node[] = [{ id: 'a', position: { x: 999, y: 888 }, data: {} }];
        vi.mocked(reflowContainersToFitChildren).mockReturnValue(reflowedNodes);
        const onPositionsChange = vi.fn();

        const api = renderHarness({ persistKey: 'ns/id', onPositionsChange });

        await act(async () => {
            api.current?.onNodesChange([dragEnd]);
            // The handler has returned and its state update still has to be
            // applied: a report sent from the handler would already be here.
            expect(onPositionsChange).not.toHaveBeenCalled();
        });

        expect(onPositionsChange).toHaveBeenCalledTimes(1);
        expect(onPositionsChange).toHaveBeenCalledWith([{ id: 'a', position: { x: 999, y: 888 } }]);
    });

    it.each([
        ['another text size', { scale: 2, presenting: false }],
        ['presentation mode', { scale: 1, presenting: true }],
    ])('reports the positions without the measured sizes at %s, so a saved default layout does not carry them', async (_case, settings) => {
        Object.assign(viewSettings, settings);
        try {
            vi.mocked(reflowContainersToFitChildren).mockReturnValueOnce([
                { id: 'a', type: 'custom', position: { x: 999, y: 888 }, data: {}, width: 220, height: 130, measured: { width: 220, height: 130 } } as Node,
            ]);
            const onPositionsChange = vi.fn();
            const api = renderHarness({ persistKey: 'ns/id', onPositionsChange });

            await act(async () => {
                api.current?.onNodesChange([dragEnd]);
            });

            expect(onPositionsChange).toHaveBeenCalledWith([{ id: 'a', position: { x: 999, y: 888 } }]);
        } finally {
            viewSettings.scale = 1;
            viewSettings.presenting = false;
        }
    });

    it('does not report mid-drag', async () => {
        const onPositionsChange = vi.fn();
        const api = renderHarness({ persistKey: 'ns/id', onPositionsChange });

        await act(async () => {
            api.current?.onNodesChange([dragging]);
        });

        expect(onPositionsChange).not.toHaveBeenCalled();
    });

    it('reports even without a persistKey (report and persist are independent)', async () => {
        const onPositionsChange = vi.fn();
        const api = renderHarness({ onPositionsChange });

        await act(async () => {
            api.current?.onNodesChange([dragEnd]);
        });

        expect(onPositionsChange).toHaveBeenCalledTimes(1);
        expect(saveNodePositions).not.toHaveBeenCalled();
    });

    it('lets the parent set its own state without a render-phase update warning', async () => {
        // The #3503 symptom itself: onPositionsChange (DiagramSection's setState)
        // ran while ArchitectureGraph rendered, so the state owner and the hook
        // live in different components here.
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const messages: string[] = [];
        const reported: StoredNodePosition[][] = [];
        const api: { current: ReturnType<typeof useGraphInteractions> | null } = { current: null };

        try {
            consoleError.mockImplementation((...args: unknown[]) => {
                messages.push(args.map(String).join(' '));
            });

            function Graph({ onPositionsChange }: { onPositionsChange: (positions: StoredNodePosition[]) => void }) {
                const [nodes, setNodes, onNodesChangeBase] = useNodesState(currentNodes);
                api.current = useGraphInteractions({
                    nodes,
                    setNodes,
                    onNodesChangeBase,
                    groupNodeTypes: ['group'],
                    onPositionsChange,
                });
                return null;
            }

            function Diagram() {
                const [positions, setPositions] = useState<StoredNodePosition[]>([]);
                const reportPositions = useCallback((next: StoredNodePosition[]) => {
                    reported.push(next);
                    setPositions(next);
                }, []);
                return createElement(
                    'span',
                    null,
                    createElement(Graph, { onPositionsChange: reportPositions }),
                    `positions: ${positions.length}`
                );
            }

            render(createElement(Diagram));
            await act(async () => {
                api.current?.onNodesChange([dragEnd]);
            });

            expect(messages.filter((message) => message.includes('Cannot update a component'))).toEqual([]);
            expect(reported).toEqual([[{ id: 'a', position: { x: 10, y: 20 } }]]);
        } finally {
            consoleError.mockRestore();
        }
    });
});

// Pins the reference-stability the memoised node components rely on: an
// untouched node must come back as the exact same object, or React.memo
// re-renders it anyway.
describe('useGraphInteractions hover z-index', () => {
    const hoverNodes: Node[] = [
        { id: 'a', type: 'custom', position: { x: 0, y: 0 }, data: {}, style: { zIndex: 1 } },
        { id: 'b', type: 'custom', position: { x: 0, y: 0 }, data: {}, style: { zIndex: 1 } },
        { id: 'g', type: 'group', position: { x: 0, y: 0 }, data: {}, style: { zIndex: -1 } },
    ];

    function setupHover() {
        let updated: Node[] = [];
        const setNodes = vi.fn((updater: (nodes: Node[]) => Node[]) => {
            updated = updater(hoverNodes);
        });
        const { result } = renderHook(() =>
            useGraphInteractions({
                nodes: hoverNodes,
                setNodes: setNodes as unknown as React.Dispatch<React.SetStateAction<Node[]>>,
                onNodesChangeBase: vi.fn(),
                groupNodeTypes: ['group'],
            })
        );
        return { result, getUpdated: () => updated };
    }

    it('elevates only the hovered node and keeps other node references stable', () => {
        const { result, getUpdated } = setupHover();
        result.current.handleNodeMouseEnter({} as ReactMouseEvent, hoverNodes[0]);
        const [a, b, g] = getUpdated();
        expect(a.style?.zIndex).toBe(1000);
        expect(a).not.toBe(hoverNodes[0]);
        expect(b).toBe(hoverNodes[1]);
        expect(g).toBe(hoverNodes[2]);
    });

    it('resets only the elevated node on mouse leave', () => {
        const { result, getUpdated } = setupHover();
        result.current.handleNodeMouseEnter({} as ReactMouseEvent, hoverNodes[0]);
        const elevated = getUpdated();

        const setNodes = vi.fn((updater: (nodes: Node[]) => Node[]) => updater(elevated));
        const { result: result2 } = renderHook(() =>
            useGraphInteractions({
                nodes: elevated,
                setNodes: setNodes as unknown as React.Dispatch<React.SetStateAction<Node[]>>,
                onNodesChangeBase: vi.fn(),
                groupNodeTypes: ['group'],
            })
        );
        result2.current.handleNodeMouseLeave();

        const [a, b, g] = setNodes.mock.results[0].value as Node[];
        expect(a.style?.zIndex).toBe(1);
        expect(b).toBe(elevated[1]);
        expect(g).toBe(elevated[2]);
    });
});
