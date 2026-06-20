import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Node,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    type Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { readViewportForKey, saveViewportForKey } from './utils/viewportStore.js';
import { FloatingEdge } from './FloatingEdge.js';
import { CustomNode } from './CustomNode.js';
import { SystemGroupNode } from './SystemGroupNode.js';
import { SearchBar } from './SearchBar.js';
import { THEME } from './theme.js';
import { EmptyGraphState } from './EmptyGraphState.js';
import { parseCALMData } from './utils/calmTransformer.js';
import { getMatchingNodeIds, isEdgeVisible, getUniqueNodeTypes } from './utils/searchUtils.js';
import { useGraphInteractions } from './hooks/useGraphInteractions.js';
import { applyStoredPositions } from '../../services/node-position-service.js';
import { useIsMobile } from '../../../hooks/useMediaQuery.js';
import type { ArchitectureGraphProps } from '../../contracts/contracts.js';

const edgeTypes = { custom: FloatingEdge };
const nodeTypes = { custom: CustomNode, group: SystemGroupNode };
const GROUP_NODE_TYPES = ['group'];

export function ArchitectureGraph({ jsonData, onNodeClick, onEdgeClick, viewportKey }: ArchitectureGraphProps) {
    // Restore the saved viewport for this diagram (so a refresh keeps the zoom/pan);
    // a different diagram has no saved viewport for its key, so it fits to view.
    const savedViewport = useMemo<Viewport | undefined>(
        () => (viewportKey ? readViewportForKey(viewportKey) : undefined),
        [viewportKey]
    );

    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('');

    // Ref holds the structural node data from parsing.
    // Filter effect reads from this instead of reactive state to avoid
    // re-triggering when setNodes/setEdges update styles.
    const sourceNodesRef = useRef<Node[]>([]);

    const [availableNodeTypes, setAvailableNodeTypes] = useState<string[]>([]);
    const isMobile = useIsMobile();

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
        persistKey: viewportKey,
    });

    useEffect(() => {
        const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick);
        sourceNodesRef.current = parsedNodes;
        // Restore any custom layout the user dragged for this diagram, falling
        // back to the parsed auto-layout when none is stored.
        setNodes(viewportKey ? applyStoredPositions(viewportKey, parsedNodes) : parsedNodes);
        setEdges(parsedEdges);
        setAvailableNodeTypes(getUniqueNodeTypes(parsedNodes));
    }, [jsonData, setNodes, setEdges, onNodeClick, viewportKey]);

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

    if (nodes.length === 0) {
        return <EmptyGraphState message="No architecture data to display. Load a CALM architecture to visualize." />;
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <ReactFlow
                // Remount when the diagram (resource) changes so a new architecture fits
                // afresh; switching versions/moments keeps the same key and preserves the view.
                key={viewportKey}
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
                onMove={(_, viewport) => {
                    if (viewportKey) saveViewportForKey(viewportKey, viewport);
                }}
                fitView={!savedViewport}
                defaultViewport={savedViewport}
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.1}
                attributionPosition="bottom-left"
                style={{ background: THEME.colors.background }}
            >
                <Background color={THEME.colors.border} gap={16} />
                {!isMobile && (
                    <Controls
                        style={{
                            background: THEME.colors.card,
                            border: `1px solid ${THEME.colors.border}`,
                            borderRadius: '8px',
                        }}
                    />
                )}
                {!isMobile && (
                    <MiniMap
                        style={{
                            background: THEME.colors.backgroundSecondary,
                            border: `1px solid ${THEME.colors.border}`,
                        }}
                        nodeColor={THEME.colors.accent}
                        maskColor={`${THEME.colors.background}cc`}
                    />
                )}
                {/* Offset left so it clears the diagram's top-right view-options menu. */}
                <Panel position="top-right" style={{ marginRight: '2.75rem' }}>
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
