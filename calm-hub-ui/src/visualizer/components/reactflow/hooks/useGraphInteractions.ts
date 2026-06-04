import { useCallback } from 'react';
import { Node, Edge, NodeChange } from 'reactflow';
import { reflowContainersToFitChildren } from '../utils/layoutUtils.js';

interface UseGraphInteractionsOptions {
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    onNodesChangeBase: (changes: NodeChange[]) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onNodeClick?: (data: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onEdgeClick?: (data: any) => void;
    groupNodeTypes: string[];
}

export function useGraphInteractions({
    setNodes,
    onNodesChangeBase,
    onNodeClick,
    onEdgeClick,
    groupNodeTypes,
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

            if (hasPositionChanges) {
                setNodes((currentNodes) => reflowContainersToFitChildren(currentNodes));
            }
        },
        [onNodesChangeBase, setNodes]
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
