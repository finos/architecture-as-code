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
import { DecisionGroupNode } from './DecisionGroupNode';
import { OptionsDecisionNode } from './OptionsDecisionNode';
import { THEME } from './theme';
import { parsePatternData } from './utils/patternTransformer';
import { calculateGroupBounds } from './utils/layoutUtils.js';

interface PatternGraphProps {
    patternData: Record<string, unknown>;
    onNodeClick?: (nodeData: Record<string, unknown>) => void;
    onEdgeClick?: (edgeData: Record<string, unknown>) => void;
}

export function PatternGraph({ patternData, onNodeClick, onEdgeClick }: PatternGraphProps) {
    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const edgeTypes = useMemo(() => ({ custom: FloatingEdge }), []);
    const nodeTypes = useMemo(() => ({
        custom: CustomNode,
        group: SystemGroupNode,
        decisionGroup: DecisionGroupNode,
        optionsDecision: OptionsDecisionNode,
    }), []);

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = parsePatternData(patternData);
        setNodes(parsedNodes);
        setEdges(parsedEdges);
    }, [patternData, setNodes, setEdges]);

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
                        if (node.type !== 'group' && node.type !== 'decisionGroup') return node;
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
                        zIndex: n.id === node.id && n.type !== 'group' && n.type !== 'decisionGroup' ? 1000
                            : (n.type === 'group' || n.type === 'decisionGroup') ? -1
                            : 1,
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
                    zIndex: (n.type === 'group' || n.type === 'decisionGroup') ? -1 : 1,
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
                    No pattern data to display. Load a CALM pattern to visualize.
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
}
