import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FloatingEdge } from './FloatingEdge';
import { CustomNode } from './CustomNode';
import { SystemGroupNode } from './SystemGroupNode';
import { DecisionGroupNode } from './DecisionGroupNode';
import { SearchBar } from './SearchBar.js';
import { THEME } from './theme';
import { parsePatternData } from './utils/patternTransformer';
import { calculateGroupBounds } from './utils/layoutUtils.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import { DecisionSelectorPanel } from './DecisionSelectorPanel.js';
import {
    extractDecisionPoints,
    DecisionSelections,
    isDecisionFilterActive,
    getVisibleNodeIds,
    getVisibleEdgeIds,
} from './utils/decisionUtils.js';

const edgeTypes = { custom: FloatingEdge };
const nodeTypes = {
    custom: CustomNode,
    group: SystemGroupNode,
    decisionGroup: DecisionGroupNode,
};

interface PatternGraphProps {
    patternData: Record<string, unknown>;
    onNodeClick?: (nodeData: Record<string, unknown>) => void;
    onEdgeClick?: (edgeData: Record<string, unknown>) => void;
}

export function PatternGraph({ patternData, onNodeClick, onEdgeClick }: PatternGraphProps) {
    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [decisionSelections, setDecisionSelections] = useState<DecisionSelections>(new Map());

    // Refs hold the structural node/edge data from parsing.
    // Filter effects read from these instead of reactive state to avoid
    // re-triggering when setNodes/setEdges update styles.
    const sourceNodesRef = useRef<Node[]>([]);
    const sourceEdgesRef = useRef<Edge[]>([]);

    const [availableNodeTypes, setAvailableNodeTypes] = useState<string[]>([]);
    const [decisionPoints, setDecisionPoints] = useState<ReturnType<typeof extractDecisionPoints>>([]);

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = parsePatternData(patternData);
        sourceNodesRef.current = parsedNodes;
        sourceEdgesRef.current = parsedEdges;
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        setAvailableNodeTypes(getUniqueNodeTypes(parsedNodes));
        setDecisionPoints(extractDecisionPoints(parsedNodes));
    }, [patternData, setNodes, setEdges]);

    // Search & filter
    const isSearchActive = searchTerm !== '' || typeFilter !== '';
    const isDecisionActive = isDecisionFilterActive(decisionSelections);

    useEffect(() => {
        if (!isSearchActive && !isDecisionActive) {
            setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: undefined } })));
            setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, opacity: undefined } })));
            return;
        }

        const srcNodes = sourceNodesRef.current;
        const srcEdges = sourceEdgesRef.current;

        const searchVisibleNodeIds = isSearchActive ? getMatchingNodeIds(srcNodes, searchTerm, typeFilter) : null;
        const decisionVisibleNodeIds = getVisibleNodeIds(srcNodes, decisionPoints, decisionSelections);

        // Intersect: a node is visible if it passes both filters (null = no constraint)
        const finalVisibleNodeIds = new Set<string>();
        for (const node of srcNodes) {
            const inSearch = searchVisibleNodeIds === null || searchVisibleNodeIds.has(node.id);
            const inDecision = decisionVisibleNodeIds === null || decisionVisibleNodeIds.has(node.id);
            if (inSearch && inDecision) {
                finalVisibleNodeIds.add(node.id);
            }
        }

        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: { ...n.style, opacity: finalVisibleNodeIds.has(n.id) ? 1 : 0.15 },
            }))
        );

        const decisionVisibleEdgeIds = isDecisionActive && decisionVisibleNodeIds
            ? getVisibleEdgeIds(srcEdges, decisionVisibleNodeIds, decisionPoints, decisionSelections)
            : null;

        setEdges((eds) =>
            eds.map((e) => {
                const searchVisible = searchVisibleNodeIds === null || isEdgeVisible(e, searchVisibleNodeIds);
                const decisionVisible = decisionVisibleEdgeIds === null || decisionVisibleEdgeIds.has(e.id);
                return {
                    ...e,
                    style: { ...e.style, opacity: searchVisible && decisionVisible ? 1 : 0.1 },
                };
            })
        );
    }, [searchTerm, typeFilter, isSearchActive, isDecisionActive, decisionSelections, decisionPoints, setNodes, setEdges]);

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

    const handleDecisionSelectionChange = useCallback(
        (groupId: string, selectedIndices: number[]) => {
            setDecisionSelections((prev) => {
                const next = new Map(prev);
                if (selectedIndices.length === 0) {
                    next.delete(groupId);
                } else {
                    next.set(groupId, selectedIndices);
                }
                return next;
            });
        },
        []
    );

    const handleDecisionReset = useCallback(() => {
        setDecisionSelections(new Map());
    }, []);

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
                <Panel position="top-left">
                    <DecisionSelectorPanel
                        decisionPoints={decisionPoints}
                        selections={decisionSelections}
                        onSelectionChange={handleDecisionSelectionChange}
                        onReset={handleDecisionReset}
                    />
                </Panel>
                <Panel position="top-right">
                    <SearchBar
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        typeFilter={typeFilter}
                        onTypeFilterChange={setTypeFilter}
                        nodeTypes={availableNodeTypes}
                    />
                </Panel>
            </ReactFlow>
        </div>
    );
}
