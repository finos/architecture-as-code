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
import { SearchBar } from './SearchBar.js';
import { THEME } from './theme';
import { parseCALMData } from './utils/calmTransformer';
import { calculateGroupBounds } from './utils/layoutUtils.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '@finos/calm-models/types';

const edgeTypes = { custom: FloatingEdge };
const nodeTypes = { custom: CustomNode, group: SystemGroupNode };

interface ArchitectureGraphProps {
    jsonData: CalmArchitectureSchema;
    onNodeClick?: (node: CalmNodeSchema) => void;
    onEdgeClick?: (edge: CalmRelationshipSchema) => void;
}

export function ArchitectureGraph({ jsonData, onNodeClick, onEdgeClick }: ArchitectureGraphProps) {
    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Ref holds the structural node data from parsing.
    // Filter effect reads from this instead of reactive state to avoid
    // re-triggering when setNodes/setEdges update styles.
    const sourceNodesRef = useRef<Node[]>([]);

    const [availableNodeTypes, setAvailableNodeTypes] = useState<string[]>([]);

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick);
        sourceNodesRef.current = parsedNodes;
        setNodes(parsedNodes);
        setEdges(parsedEdges);
        setAvailableNodeTypes(getUniqueNodeTypes(parsedNodes));
    }, [jsonData, setNodes, setEdges, onNodeClick]);

    // Search & filter
    const isSearchActive = searchTerm !== '' || typeFilter !== '';

    useEffect(() => {
        if (!isSearchActive) {
            setNodes((nds) => nds.map((n) => ({ ...n, style: { ...n.style, opacity: undefined } })));
            setEdges((eds) => eds.map((e) => ({ ...e, style: { ...e.style, opacity: undefined } })));
            return;
        }
        const srcNodes = sourceNodesRef.current;
        const matchingIds = getMatchingNodeIds(srcNodes, searchTerm, typeFilter);
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: { ...n.style, opacity: matchingIds.has(n.id) ? 1 : 0.15 },
            }))
        );
        setEdges((eds) =>
            eds.map((e) => ({
                ...e,
                style: { ...e.style, opacity: isEdgeVisible(e, matchingIds) ? 1 : 0.1 },
            }))
        );
    }, [searchTerm, typeFilter, isSearchActive, setNodes, setEdges]);

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
};
