import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FloatingEdge } from './FloatingEdge';
import { CustomNode } from './CustomNode';
import { SystemGroupNode } from './SystemGroupNode';
import { THEME } from './theme';
import { parseCALMData } from './utils/calmTransformer';
import { GRAPH_LAYOUT } from './utils/constants';
import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '../../../../../calm-models/src/types/core-types.js';

interface ArchitectureGraphProps {
    jsonData: CalmArchitectureSchema;
    onNodeClick?: (node: CalmNodeSchema) => void;
    onEdgeClick?: (edge: CalmRelationshipSchema) => void;
}

/**
 * Calculate the minimum bounds for a group node based on its children
 */
function calculateGroupBounds(
    groupId: string,
    allNodes: Node[]
): { width: number; height: number } | null {
    const children = allNodes.filter((n) => n.parentId === groupId);
    if (children.length === 0) {
        return null;
    }

    const padding = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;
    const nodeWidth = GRAPH_LAYOUT.NODE_WIDTH;
    const nodeHeight = GRAPH_LAYOUT.NODE_HEIGHT;

    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
        const childRight = child.position.x + nodeWidth;
        const childBottom = child.position.y + nodeHeight;
        maxX = Math.max(maxX, childRight);
        maxY = Math.max(maxY, childBottom);
    });

    // Add padding on the right and bottom
    return {
        width: maxX + padding,
        height: maxY + padding,
    };
}

export function ArchitectureGraph({ jsonData, onNodeClick, onEdgeClick }: ArchitectureGraphProps) {
    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const edgeTypes = useMemo(() => ({ custom: FloatingEdge }), []);
    const nodeTypes = useMemo(() => ({ custom: CustomNode, group: SystemGroupNode }), []);

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick);
        setNodes(parsedNodes);
        setEdges(parsedEdges);
    }, [jsonData, setNodes, setEdges, onNodeClick]);

    // Custom onNodesChange that recalculates group bounds after node movements
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            // Apply the base changes first
            onNodesChangeBase(changes);

            // Check if any position changes occurred (from dragging)
            const hasPositionChanges = changes.some(
                (change) => change.type === 'position' && change.dragging === false
            );

            if (hasPositionChanges) {
                // Recalculate group bounds after drag completes
                setNodes((currentNodes) => {
                    let updated = false;

                    const newNodes = currentNodes.map((node) => {
                        if (node.type !== 'group') return node;

                        const bounds = calculateGroupBounds(node.id, currentNodes);
                        if (!bounds) return node;

                        const currentWidth = (node.style?.width as number) || node.width || 0;
                        const currentHeight = (node.style?.height as number) || node.height || 0;

                        // Only update if bounds have changed
                        if (bounds.width !== currentWidth || bounds.height !== currentHeight) {
                            updated = true;
                            return {
                                ...node,
                                width: bounds.width,
                                height: bounds.height,
                                style: {
                                    ...node.style,
                                    width: bounds.width,
                                    height: bounds.height,
                                },
                            };
                        }
                        return node;
                    });

                    return updated ? newNodes : currentNodes;
                });
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

    const handleNodeMouseEnter = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            setNodes((nds) =>
                nds.map((n) => ({
                    ...n,
                    style: {
                        ...n.style,
                        zIndex: n.id === node.id && n.type !== 'group' ? 1000 : n.type === 'group' ? -1 : 1,
                    },
                }))
            );
        },
        [setNodes]
    );

    const handleNodeMouseLeave = useCallback(() => {
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: {
                    ...n.style,
                    zIndex: n.type === 'group' ? -1 : 1,
                },
            }))
        );
    }, [setNodes]);

    const handleEdgeClick = useCallback(
        (_event: React.MouseEvent, edge: Edge) => {
            if (onEdgeClick) {
                onEdgeClick(edge.data);
            }
        },
        [onEdgeClick]
    );

    const isEmpty = nodes.length === 0;

    if (isEmpty) {
        return (
            <div
                style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: THEME.colors.background,
                    color: THEME.colors.muted,
                    fontSize: '14px',
                }}
            >
                <div
                    style={{
                        padding: '24px',
                        background: THEME.colors.backgroundSecondary,
                        borderRadius: '8px',
                        border: `1px solid ${THEME.colors.border}`,
                        maxWidth: '400px',
                        textAlign: 'center',
                    }}
                >
                    No architecture data to display. Load a CALM architecture to visualize.
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                onNodeMouseEnter={handleNodeMouseEnter}
                onNodeMouseLeave={handleNodeMouseLeave}
                onEdgeClick={handleEdgeClick}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                attributionPosition="bottom-left"
                style={{ background: THEME.colors.background }}
            >
                <Background color={THEME.colors.border} gap={16} />
                <Controls
                    style={{
                        background: THEME.colors.card,
                        border: `1px solid ${THEME.colors.border}`,
                        borderRadius: '8px',
                    }}
                />
                <MiniMap
                    style={{
                        background: THEME.colors.backgroundSecondary,
                        border: `1px solid ${THEME.colors.border}`,
                    }}
                    nodeColor={THEME.colors.accent}
                    maskColor={`${THEME.colors.background}cc`}
                />
            </ReactFlow>
        </div>
    );
};
