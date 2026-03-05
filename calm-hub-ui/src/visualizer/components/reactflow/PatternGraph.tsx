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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FloatingEdge } from './FloatingEdge.js';
import { CustomNode } from './CustomNode.js';
import { SystemGroupNode } from './SystemGroupNode.js';
import { DecisionGroupNode } from './DecisionGroupNode.js';
import { SearchBar } from './SearchBar.js';
import { THEME } from './theme.js';
import { EmptyGraphState } from './EmptyGraphState.js';
import { parsePatternData } from './utils/patternTransformer.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import { useGraphInteractions } from './hooks/useGraphInteractions.js';
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
const GROUP_NODE_TYPES = ['group', 'decisionGroup'];

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

    const {
        onNodesChange,
        handleNodeClick,
        handleEdgeClick,
        handleNodeMouseEnter,
        handleNodeMouseLeave,
    } = useGraphInteractions({
        setNodes,
        onNodesChangeBase,
        onNodeClick,
        onEdgeClick,
        groupNodeTypes: GROUP_NODE_TYPES,
    });

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

    if (nodes.length === 0) {
        return <EmptyGraphState message="No pattern data to display. Load a CALM pattern to visualize." />;
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
