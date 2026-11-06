import { useCallback, useEffect, useRef } from 'react';
import { Node, Edge, NodeChange } from 'reactflow';
import { reflowContainersToFitChildren } from '../utils/layoutUtils.js';
import { saveNodePositions, toStoredPositions, type StoredNodePosition } from '../../../services/node-position-service.js';

interface UseGraphInteractionsOptions {
    /** The graph's current nodes; the drag-end report fires on the commit that changes them. */
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    onNodesChangeBase: (changes: NodeChange[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNodeClick?: (data: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onEdgeClick?: (data: any) => void;
    groupNodeTypes: string[];
    // Key (namespace/id) under which to persist the layout on drag-end; when
    // absent, layout changes are not persisted.
    persistKey?: string;
    /** Reports the post-reflow positions upward at drag-end (see ArchitectureGraph). */
    onPositionsChange?: (positions: StoredNodePosition[]) => void;
}

export function useGraphInteractions({
    nodes,
    setNodes,
    onNodesChangeBase,
    onNodeClick,
    onEdgeClick,
    groupNodeTypes,
    persistKey,
    onPositionsChange,
}: UseGraphInteractionsOptions) {
    // Positions computed at drag-end inside the setNodes updater, reported after
    // the render that applies them. Calling onPositionsChange from the updater
    // made DiagramSection set its own state while ArchitectureGraph was
    // rendering, which React reports as "Cannot update a component
    // (DiagramSection) while rendering a different component
    // (ArchitectureGraph)" (issue #3503).
    const pendingReport = useRef<StoredNodePosition[] | null>(null);

    // Only ever called from the effect below, never from the updater: React
    // reports "Cannot update a component while rendering a different component"
    // when a parent setState runs from inside one.
    const flushReport = useCallback(() => {
        const positions = pendingReport.current;
        if (!positions) return;
        pendingReport.current = null;
        onPositionsChange?.(positions);
    }, [onPositionsChange]);

    // The only report path. React runs the updater during the render — eagerly
    // only when its queue is empty, which it never is here because
    // onNodesChangeBase queued a change on the same state first — so the report
    // lands here, after the commit that applied the reflowed nodes, and never
    // while a component renders. Keying the effect to `nodes` keeps it off
    // renders that cannot produce a report.
    useEffect(() => {
        flushReport();
    }, [nodes, flushReport]);

    const isGroupType = useCallback(
        (type: string | undefined) => type != null && groupNodeTypes.includes(type),
        [groupNodeTypes]
    );

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            onNodesChangeBase(changes);

            // Reflow on every position change (during the drag, not just at the
            // end) so containers resize live to keep their children enclosed on
            // all sides. ReactFlow recomputes the dragged node's parent-relative
            // position each frame, so shifting a container's origin mid-drag
            // stays consistent with the pointer.
            const hasPositionChanges = changes.some((change) => change.type === 'position');
            // A drag has finished when ReactFlow reports a position change with
            // dragging explicitly false — the moment to persist the new layout.
            const dragEnded = changes.some(
                (change) => change.type === 'position' && change.dragging === false
            );

            if (hasPositionChanges) {
                setNodes((currentNodes) => {
                    const reflowed = reflowContainersToFitChildren(currentNodes);
                    // Persist the post-reflow positions so a restore needs no
                    // further adjustment. Writing in the updater reads the
                    // latest state; the write is idempotent so StrictMode's
                    // double-invoke is harmless.
                    if (dragEnded && persistKey) saveNodePositions(persistKey, reflowed);
                    // Report at drag-end only (not every position change during
                    // the drag) so "Save as default layout" always reflects the
                    // latest settled arrangement without re-rendering on every
                    // frame. The call itself happens in the effect above, after
                    // this updater has finished.
                    if (dragEnded) pendingReport.current = toStoredPositions(reflowed);
                    return reflowed;
                });
            }
        },
        [onNodesChangeBase, setNodes, persistKey]
    );

    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            if (onNodeClick) {
                onNodeClick(node.data);
            }
        },
        [onNodeClick]
    );

    const handleEdgeClick = useCallback(
        (_event: React.MouseEvent, edge: Edge) => {
            if (onEdgeClick) {
                onEdgeClick(edge.data);
            }
        },
        [onEdgeClick]
    );

    const handleNodeMouseEnter = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            setNodes((nds) =>
                nds.map((n) => {
                    const zIndex = n.id === node.id && !isGroupType(n.type) ? 1000
                        : isGroupType(n.type) ? -1
                        : 1;
                    // Return the untouched node as-is: ReactFlow's memoised
                    // NodeWrapper compares `style` by reference, so a fresh
                    // object here re-renders every node on each hover.
                    if (n.style?.zIndex === zIndex) return n;
                    return { ...n, style: { ...n.style, zIndex } };
                })
            );
        },
        [setNodes, isGroupType]
    );

    const handleNodeMouseLeave = useCallback(() => {
        setNodes((nds) =>
            nds.map((n) => {
                const zIndex = isGroupType(n.type) ? -1 : 1;
                if (n.style?.zIndex === zIndex) return n;
                return { ...n, style: { ...n.style, zIndex } };
            })
        );
    }, [setNodes, isGroupType]);

    return {
        onNodesChange,
        handleNodeClick,
        handleEdgeClick,
        handleNodeMouseEnter,
        handleNodeMouseLeave,
    };
}
