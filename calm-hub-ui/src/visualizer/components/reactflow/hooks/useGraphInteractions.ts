import { useCallback } from 'react';
import { Node, Edge, NodeChange } from 'reactflow';
import { reflowContainersToFitChildren } from '../utils/layoutUtils.js';
import { saveNodePositions } from '../../../services/node-position-service.js';

interface UseGraphInteractionsOptions {
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
}

export function useGraphInteractions({
    setNodes,
    onNodesChangeBase,
    onNodeClick,
    onEdgeClick,
    groupNodeTypes,
    persistKey,
}: UseGraphInteractionsOptions) {
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
                nds.map((n) => ({
                    ...n,
                    style: {
                        ...n.style,
                        zIndex: n.id === node.id && !isGroupType(n.type) ? 1000
                            : isGroupType(n.type) ? -1
                            : 1,
                    },
                }))
            );
        },
        [setNodes, isGroupType]
    );

    const handleNodeMouseLeave = useCallback(() => {
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: {
                    ...n.style,
                    zIndex: isGroupType(n.type) ? -1 : 1,
                },
            }))
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
