import { useCallback } from 'react';
import { Node, Edge, NodeChange } from 'reactflow';
import { calculateGroupBounds } from '../utils/layoutUtils.js';

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

            const hasPositionChanges = changes.some(
                (change) => change.type === 'position' && change.dragging === false
            );

            if (hasPositionChanges) {
                setNodes((currentNodes) => {
                    let updated = false;
                    const newNodes = currentNodes.map((node) => {
                        if (!isGroupType(node.type)) return node;
                        const bounds = calculateGroupBounds(node.id, currentNodes);
                        if (!bounds) return node;
                        const currentWidth = (node.style?.width as number) || node.width || 0;
                        const currentHeight = (node.style?.height as number) || node.height || 0;
                        if (bounds.width !== currentWidth || bounds.height !== currentHeight) {
                            updated = true;
                            return {
                                ...node,
                                width: bounds.width,
                                height: bounds.height,
                                style: { ...node.style, width: bounds.width, height: bounds.height },
                            };
                        }
                        return node;
                    });
                    return updated ? newNodes : currentNodes;
                });
            }
        },
        [onNodesChangeBase, setNodes, isGroupType]
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
