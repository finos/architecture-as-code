import React, { useEffect, useCallback, useRef, useState } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    Background,
    Controls,
    MiniMap,
    MarkerType,
    useNodesState,
    useEdgesState,
    useReactFlow,
    addEdge,
    updateEdge,
    getRectOfNodes,
    type Node,
    type Edge,
    type Connection,
    type NodeChange,
    type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toSvg } from 'html-to-image';
import { useCanvasStore } from './stores/canvas-store';
import {
    initBridge,
    setModelUpdateCallback,
    setPatternsLoadedCallback,
    setTemplatesLoadedCallback,
    setBuildingBlocksLoadedCallback,
    setStandardsLoadedCallback,
    setDrillResultCallback,
    setStandardProseCallback,
    notifyCanvasChanged,
    notifyDrillInto,
    notifyDrillUp,
    requestStandardProse,
    notifyRequestGenerateSpec,
    notifySaveBuildingBlock,
} from './stores/sync-bridge';
import { postMessage } from './vscode-api';
import {
    flowToCalm,
    setLastParsedArch,
    applyLayoutFromMetadata,
    type CalmArchitecture,
} from './transforms/calm-editor-transformer';
import { parseCALMData } from './transforms/calm-parser';
import { NodePalette } from './panels/NodePalette';
import { EdgeProperties } from './panels/EdgeProperties';
import { InterfaceList } from './panels/InterfaceList';
import { ControlsList } from './panels/ControlsList';
import { CustomMetadata } from './panels/CustomMetadata';
import { NodeAppearance } from './panels/NodeAppearance';
import { getNodeStyleOverride } from './utils/building-block-style';
import { PatternPicker } from './panels/PatternPicker';
import { TemplatePicker } from './panels/TemplatePicker';
import { StandardsPanel } from './panels/StandardsPanel';
import { BuildingBlockCreator } from './panels/BuildingBlockCreator';
import { ToolbarMenu } from './panels/ToolbarMenu';
import { nodeTypes } from './canvas/nodeTypes';
import { edgeTypes } from './canvas/edgeTypes';
import { makeContainment, removeContainment, isInsideBounds, getAbsolutePosition } from './utils/containment';
import { mergeControls } from './utils/controls';
import { validateArchitecture } from './utils/validation';

const SUPPRESS_ECHO_MS = 1200;
const CORE_NODE_TYPES = new Set(['actor', 'ecosystem', 'system', 'service', 'database', 'network', 'ldap', 'webclient', 'data-asset']);

function resolveFlowNodeType(calmType: string): string {
    if (CORE_NODE_TYPES.has(calmType)) return calmType;
    return 'extension';
}

function CanvasApp() {
    const containerRef = useRef<HTMLDivElement>(null);
    const store = useCanvasStore();
    const reactFlowInstance = useReactFlow();
    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState([]);
    const [initialized, setInitialized] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    const [panelWidth, setPanelWidth] = useState(280);
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [showPatternPicker, setShowPatternPicker] = useState(false);
    const [patternPickerMode, setPatternPickerMode] = useState<'new' | 'apply'>('new');
    const [showTemplatePicker, setShowTemplatePicker] = useState(false);
    const [showBuildingBlockCreator, setShowBuildingBlockCreator] = useState(false);
    const [activeRequirementUrl, setActiveRequirementUrl] = useState<string | null>(null);
    const [activeStandardProse, setActiveStandardProse] = useState<string | null>(null);
    const [expandControlKey, setExpandControlKey] = useState<string | null>(null);

    // Undo/redo
    const undoStack = useRef<string[]>([]);
    const redoStack = useRef<string[]>([]);
    const lastEmittedJson = useRef<string | null>(null);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const positionDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressFileUpdatesUntil = useRef(0);
    const syncingRef = useRef(false);
    const undoingOrRedoing = useRef(false);
    const loadGeneration = useRef(0);


    // --- Core: emit change ---
    const emitChange = useCallback((immediate = false) => {
        if (syncingRef.current || store.readonlyMode || undoingOrRedoing.current) return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        const generation = loadGeneration.current;
        const flush = () => {
            if (generation !== loadGeneration.current) return;
            const currentState = useCanvasStore.getState();
            if (currentState.readonlyMode) return;
            // Push undo state
            if (lastEmittedJson.current !== null) {
                undoStack.current.push(lastEmittedJson.current);
                if (undoStack.current.length > 50) undoStack.current.shift();
                redoStack.current = [];
            }
            const currentNodes = reactFlowInstance.getNodes();
            const currentEdges = reactFlowInstance.getEdges();
            const arch = flowToCalm(currentNodes, currentEdges, currentState.documentControls);
            const json = JSON.stringify(arch, null, 2);
            lastEmittedJson.current = json;
            notifyCanvasChanged(json);
            suppressFileUpdatesUntil.current = Date.now() + SUPPRESS_ECHO_MS;
        };

        if (immediate) flush();
        else debounceTimer.current = setTimeout(flush, 300);
    }, [reactFlowInstance, store.readonlyMode]);

    // --- Load architecture ---
    const loadArchitecture = useCallback((json: string) => {
        // Invalidate any in-flight setTimeout callbacks from prior interactions
        loadGeneration.current++;
        // Cancel any pending emit timers to prevent stale data from overwriting the file
        if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
        if (positionDebounceTimer.current) { clearTimeout(positionDebounceTimer.current); positionDebounceTimer.current = null; }

        // A blank/whitespace file means "no architecture" — clear the canvas instead of
        // keeping the previously loaded diagram (JSON.parse('') would otherwise throw and the
        // stale nodes would linger).
        if (!json || json.trim() === '') {
            setNodes([]); setEdges([]); setLastParsedArch(null);
            useCanvasStore.setState({ documentControls: {} });
            lastEmittedJson.current = json;
            return;
        }
        try {
            const arch = JSON.parse(json) as CalmArchitecture;
            if (!arch || !arch.nodes || arch.nodes.length === 0) {
                setNodes([]); setEdges([]); setLastParsedArch(null);
                useCanvasStore.setState({ documentControls: (arch as Record<string, unknown>)?.controls as Record<string, unknown> ?? {} });
                lastEmittedJson.current = json;
                return;
            }
            setLastParsedArch(arch);
            useCanvasStore.setState({ documentControls: (arch as Record<string, unknown>).controls as Record<string, unknown> ?? {} });
            const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(arch);
            const metadata = (arch as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
            const layoutedNodes = applyLayoutFromMetadata(parsedNodes, metadata);
            setNodes(layoutedNodes);
            setEdges(parsedEdges);
            lastEmittedJson.current = json;
        } catch (err) {
            console.error('[CALM Canvas] Failed to load architecture:', err);
        }
    }, [setNodes, setEdges]);

    // --- Bridge setup ---
    useEffect(() => {
        setModelUpdateCallback((json, source) => {
            if (source === 'file' && Date.now() < suppressFileUpdatesUntil.current) return;
            loadArchitecture(json);
            setInitialized(true);
        });
        setPatternsLoadedCallback((p) => useCanvasStore.setState({ loadedPatterns: p as any }));
        setTemplatesLoadedCallback((t) => useCanvasStore.setState({ loadedTemplates: t as any }));
        setBuildingBlocksLoadedCallback((n) => useCanvasStore.setState({ buildingBlocks: n as any }));
        setStandardsLoadedCallback((s) => useCanvasStore.setState({ loadedStandards: s as any }));
        setDrillResultCallback((json, label, _filePath, readonly) => {
            store.pushDrill({ label, filePath: _filePath, readonly });
            store.setReadonlyMode(readonly ?? false);
            loadArchitecture(json);
        });
        setStandardProseCallback((_url, prose) => {
            setActiveStandardProse(prose);
        });
        initBridge();

        const initialJson = (window as unknown as { __INITIAL_CALM_JSON__?: string }).__INITIAL_CALM_JSON__;
        if (initialJson) { loadArchitecture(initialJson); setInitialized(true); }
    }, [loadArchitecture]);

    // --- Undo/Redo ---
    useEffect(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (undoStack.current.length === 0 || undoingOrRedoing.current) return;
                const prev = undoStack.current.pop()!;
                if (lastEmittedJson.current) redoStack.current.push(lastEmittedJson.current);
                lastEmittedJson.current = prev;
                undoingOrRedoing.current = true;
                loadArchitecture(prev);
                notifyCanvasChanged(prev);
                suppressFileUpdatesUntil.current = Date.now() + SUPPRESS_ECHO_MS;
                setTimeout(() => { undoingOrRedoing.current = false; }, 100);
            }
            if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key === 'z') || (!e.shiftKey && e.key === 'y'))) {
                e.preventDefault();
                if (redoStack.current.length === 0 || undoingOrRedoing.current) return;
                const next = redoStack.current.pop()!;
                if (lastEmittedJson.current) undoStack.current.push(lastEmittedJson.current);
                lastEmittedJson.current = next;
                undoingOrRedoing.current = true;
                loadArchitecture(next);
                notifyCanvasChanged(next);
                suppressFileUpdatesUntil.current = Date.now() + SUPPRESS_ECHO_MS;
                setTimeout(() => { undoingOrRedoing.current = false; }, 100);
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'u') {
                e.preventDefault();
                if (selectedNode?.parentId) unparentNode(selectedNode.id);
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [loadArchitecture, selectedNode]);

    // --- Node changes (position, dimension, remove) ---
    const onNodesChange = useCallback((changes: NodeChange[]) => {
        if (store.readonlyMode) {
            const safe = changes.filter((c) => c.type === 'select' || c.type === 'dimensions');
            if (safe.length > 0) onNodesChangeBase(safe);
            return;
        }
        onNodesChangeBase(changes);

        let structural = false;
        let positionOnly = true;
        let hasDimensions = false;
        for (const c of changes) {
            if (c.type === 'remove') structural = true;
            if (c.type === 'dimensions') hasDimensions = true;
            if (c.type !== 'position') positionOnly = false;
        }

        if (positionOnly && changes.some((c) => c.type === 'position')) {
            if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
            positionDebounceTimer.current = setTimeout(() => emitChange(true), 800);
            return;
        }
        if (structural) setTimeout(() => emitChange(true), 0);
        else if (hasDimensions) {
            if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
            positionDebounceTimer.current = setTimeout(() => emitChange(true), 800);
        }
    }, [onNodesChangeBase, emitChange, store.readonlyMode]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        if (store.readonlyMode) return;
        onEdgesChangeBase(changes);
        if (changes.some((c) => c.type === 'remove')) {
            // Delay emit to allow ReactFlow's internal store to sync the removal
            setTimeout(() => emitChange(true), 0);
        }
    }, [onEdgesChangeBase, emitChange, store.readonlyMode]);

    // --- Connect ---
    const onConnect = useCallback((connection: Connection) => {
        if (store.readonlyMode) return;
        const id = `rel-${Date.now()}`;
        setEdges((eds) => addEdge({
            ...connection,
            id,
            type: 'tooltip',
            label: '',
            markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
            data: { calmRelId: id, calmVariant: 'connects', protocol: '', description: '', direction: 'source-to-target', lineStyle: 'solid' },
        }, eds));
        setTimeout(() => emitChange(true), 0);
    }, [setEdges, emitChange, store.readonlyMode]);

    // --- Delete (reactflow v11 fires onNodesDelete after removal) ---
    const onNodesDelete = useCallback((deletedNodes: Node[]) => {
        if (store.readonlyMode) return;
        const deletedIds = new Set(deletedNodes.map((n) => n.id));
        // Unparent children of deleted containers
        setNodes((nds) => {
            let updated = nds;
            for (const deleted of deletedNodes) {
                if (deleted.type === 'container') {
                    updated = updated.map((n) => {
                        if (n.parentId !== deleted.id) return n;
                        const absPos = getAbsolutePosition(n, updated);
                        const { parentId: _, extent: _e, zIndex: _z, ...rest } = n as any;
                        return { ...rest, position: absPos } as Node;
                    });
                }
            }
            return updated.filter((n) => !deletedIds.has(n.id));
        });
        setEdges((eds) => eds.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)));
        setTimeout(() => emitChange(true), 0);
    }, [setNodes, setEdges, emitChange, store.readonlyMode]);

    // --- Node click (select) ---
    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        setSelectedNode(node);
        setSelectedEdge(null);
        store.selectNode(node.id);
    }, [store]);

    // --- Node double-click (drill-in or select+focus) ---
    const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
        const data = node.data as Record<string, unknown>;
        const details = data?.details as { 'detailed-architecture'?: string } | undefined;
        const calmType = (data?.calmType as string) ?? '';
        const label = (data?.label as string) || node.id;
        const metadata = data?.metadata as Record<string, unknown> | undefined;
        const sourceBuildingBlock = metadata?.['source-building-block'] as string | undefined;

        if (details?.['detailed-architecture']) {
            notifyDrillInto(label, details['detailed-architecture'], calmType);
        } else if (sourceBuildingBlock) {
            notifyDrillInto(label, `building-blocks/${sourceBuildingBlock}.calm.json`, `building-block:${sourceBuildingBlock}`);
        } else if (calmType.includes(':')) {
            const safeName = calmType.replace(/^building-block:/, '');
            notifyDrillInto(label, `building-blocks/${safeName}.calm.json`, calmType);
        } else {
            // No drill target — select and focus the name field for editing
            setSelectedNode(node);
            store.selectNode(node.id);
        }
    }, [store]);

    const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
        setSelectedEdge(edge);
        setSelectedNode(null);
        store.selectEdge(edge.id);
    }, [store]);

    const handlePaneClick = useCallback(() => {
        setSelectedNode(null); setSelectedEdge(null);
        store.selectNode(null); store.selectEdge(null);
    }, [store]);

    // --- Node drag stop (containment detection) ---
    const handleNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
        if (store.readonlyMode) return;
        if (draggedNode.type === 'container' || draggedNode.parentId) {
            setTimeout(() => emitChange(true), 0);
            return;
        }

        // Check if dropped inside a container
        setNodes((nds) => {
            const draggedAbsPos = getAbsolutePosition(draggedNode, nds);
            for (const candidate of nds) {
                if (candidate.id === draggedNode.id) continue;
                if (candidate.type !== 'container') continue;
                const containerAbsPos = getAbsolutePosition(candidate, nds);
                const bounds = {
                    x: containerAbsPos.x,
                    y: containerAbsPos.y,
                    width: ((candidate as any).width ?? 400) as number,
                    height: ((candidate as any).height ?? 300) as number,
                };
                if (isInsideBounds(draggedAbsPos, bounds)) {
                    return makeContainment(candidate.id, draggedNode.id, nds);
                }
            }
            return nds;
        });
        setTimeout(() => emitChange(true), 0);
    }, [setNodes, emitChange, store.readonlyMode]);

    // --- Unparent ---
    const unparentNode = useCallback((nodeId: string) => {
        setNodes((nds) => removeContainment(nodeId, nds));
        setTimeout(() => emitChange(true), 0);
    }, [setNodes, emitChange]);

    // --- Node update (from properties panel) ---
    const onNodeUpdate = useCallback((nodeId: string, field: string, value: unknown) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id !== nodeId) return n;
            const data = { ...(n.data as Record<string, unknown>) };
            switch (field) {
                case 'name': data.label = value; break;
                case 'description': data.description = value; break;
                case 'node-type': data.calmType = value; break;
                case 'interfaces': data.interfaces = value; break;
                case 'controls': data.controls = value; break;
                case 'metadata': data.metadata = { ...((data.metadata as Record<string, unknown>) ?? {}), ...(value as Record<string, unknown>) }; break;
                case 'containerRole': data.containerRole = value; break;
            }
            const updated = { ...n, data };
            if (field === 'node-type') updated.type = resolveFlowNodeType(value as string);
            setSelectedNode(updated);
            return updated;
        }));
        setTimeout(() => emitChange(field !== 'name' && field !== 'description'), 0);
    }, [setNodes, emitChange]);

    // --- Drop from palette ---
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (store.readonlyMode) return;

        const buildingBlockId = e.dataTransfer.getData('application/building-block-id');
        const behaviour = e.dataTransfer.getData('application/building-block-behaviour');
        const nodeType = e.dataTransfer.getData('application/calm-node-type');
        const nodeLabel = e.dataTransfer.getData('application/calm-node-label');
        const isContainer = e.dataTransfer.getData('application/calm-container') === 'true';

        const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

        if (buildingBlockId && behaviour) {
            // Building block / standard drop
            const buildingBlock = (store.buildingBlocks as any[]).find((n: any) => n.id === buildingBlockId);
            if (!buildingBlock) return;
            const controlsCopy = JSON.parse(JSON.stringify(buildingBlock.controls ?? {})) as Record<string, unknown>;

            if (behaviour === 'apply-controls-on-drop') {
                // Find the node under the drop point.
                // Try DOM-based detection first, fall back to coordinate hit-test.
                let targetId: string | null = null;
                const elements = document.elementsFromPoint(e.clientX, e.clientY);
                for (const el of elements) {
                    const nodeEl = el.closest('.react-flow__node');
                    if (nodeEl) { targetId = nodeEl.getAttribute('data-id'); break; }
                }
                // Fallback: check flow coordinates against node bounds
                if (!targetId) {
                    const flowPos = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
                    for (const n of nodes) {
                        if (n.type === 'container') continue;
                        const w = n.width ?? 150;
                        const h = n.height ?? 40;
                        const absX = n.positionAbsolute?.x ?? n.position.x;
                        const absY = n.positionAbsolute?.y ?? n.position.y;
                        if (flowPos.x >= absX && flowPos.x <= absX + w
                            && flowPos.y >= absY && flowPos.y <= absY + h) {
                            targetId = n.id;
                            break;
                        }
                    }
                }
                if (targetId) {
                    // Merge controls into target (if any) and create standards node + edge
                    setNodes((nds) => {
                        const existingStdNode = nds.find(
                            (n) => (n.data as any)?.metadata?.['source-building-block'] === buildingBlockId
                        );
                        let stdNodeId: string;
                        let updatedNodes = nds.map((n) => {
                            if (n.id !== targetId) return n;
                            if (Object.keys(controlsCopy).length === 0) return n;
                            const data = { ...(n.data as Record<string, unknown>) };
                            data.controls = mergeControls((data.controls as Record<string, unknown>) ?? {}, controlsCopy);
                            return { ...n, data };
                        });

                        if (existingStdNode) {
                            stdNodeId = existingStdNode.id;
                        } else {
                            // Create a standards node near the drop position
                            stdNodeId = `standard-${Date.now()}`;
                            const stdNode: Node = {
                                id: stdNodeId,
                                type: resolveFlowNodeType('service'),
                                position: { x: position.x + 200, y: position.y - 100 },
                                data: {
                                    label: buildingBlock.name,
                                    calmId: stdNodeId,
                                    calmType: 'standard',
                                    description: buildingBlock.description ?? '',
                                    interfaces: [],
                                    controls: {},
                                    metadata: { 'source-building-block': buildingBlockId },
                                },
                            };
                            updatedNodes = [...updatedNodes, stdNode];
                        }

                        // Create "adheres to" dotted edge (if not already connected)
                        setEdges((eds) => {
                            const alreadyLinked = eds.some(
                                (edge) => edge.source === targetId && edge.target === stdNodeId
                                    && (edge.data as any)?.lineStyle === 'dotted'
                            );
                            if (alreadyLinked) return eds;
                            const edgeId = `rel-${Date.now()}`;
                            return [...eds, {
                                id: edgeId,
                                source: targetId!,
                                target: stdNodeId,
                                type: 'tooltip',
                                label: 'adheres to',
                                markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
                                style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                                data: {
                                    calmRelId: edgeId,
                                    calmVariant: 'connects',
                                    protocol: '',
                                    description: 'adheres to',
                                    direction: 'source-to-target',
                                    lineStyle: 'dotted',
                                },
                            }];
                        });

                        return updatedNodes;
                    });
                    setTimeout(() => emitChange(true), 0);
                    return;
                }
                // No target (or no controls to apply) — fall through to place a standalone marker.
            }

            const id = `${buildingBlock.nodeType}-${Date.now()}`;
            const newNode: Node = {
                id,
                type: resolveFlowNodeType(buildingBlock.nodeType),
                position,
                data: {
                    label: buildingBlock.name,
                    calmId: id,
                    calmType: buildingBlock.nodeType,
                    description: buildingBlock.description ?? '',
                    interfaces: [],
                    controls: controlsCopy,
                    metadata: { 'source-building-block': buildingBlock.id },
                },
            };
            setNodes((nds) => [...nds, newNode]);
            setTimeout(() => emitChange(true), 0);
            return;
        }

        if (!nodeType) return;
        const id = `${nodeType.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;

        if (isContainer) {
            setNodes((nds) => [...nds, {
                id, type: 'container', position, width: 400, height: 300,
                data: { label: nodeLabel || 'Container', calmId: id, calmType: nodeType, description: '', containerRole: 'default', containmentType: 'deployed-in' },
            } as Node]);
        } else {
            setNodes((nds) => [...nds, {
                id, type: resolveFlowNodeType(nodeType), position,
                data: { label: nodeLabel || nodeType, calmId: id, calmType: nodeType, description: '', interfaces: [], metadata: {} },
            }]);
        }
        setTimeout(() => emitChange(true), 0);
    }, [nodes, setNodes, setEdges, emitChange, reactFlowInstance, store.readonlyMode, store.buildingBlocks]);

    // --- Validate ---
    const handleValidate = useCallback(() => {
        // Re-resolve controls onto standard/guideline nodes from the palette item they came
        // from (via `source-building-block`). Nodes dropped before their front-matter controls
        // were available — or whose controls were never populated — otherwise validate as
        // empty. Only backfill when the node currently has no controls of its own.
        const paletteControlsById = new Map<string, Record<string, unknown>>();
        for (const fn of store.buildingBlocks as Array<{ id?: string; controls?: Record<string, unknown> }>) {
            if (fn?.id && fn.controls && Object.keys(fn.controls).length > 0) {
                paletteControlsById.set(fn.id, fn.controls);
            }
        }
        const effectiveNodes = nodes.map((n) => {
            const data = (n.data ?? {}) as Record<string, unknown>;
            const meta = data.metadata as Record<string, unknown> | undefined;
            const sourceId = meta?.['source-building-block'] as string | undefined;
            if (!sourceId) return n;
            const palette = paletteControlsById.get(sourceId);
            if (!palette) return n;
            const current = data.controls as Record<string, unknown> | undefined;
            if (current && Object.keys(current).length > 0) return n;
            return { ...n, data: { ...data, controls: JSON.parse(JSON.stringify(palette)) as Record<string, unknown> } };
        });

        const arch = flowToCalm(effectiveNodes, edges, store.documentControls);
        const issues = validateArchitecture(arch);
        // Count controls actually present so the result makes it clear whether there was
        // anything to validate (a common confusion: plain node-type nodes have no controls).
        let controlCount = Object.keys((arch.controls as Record<string, unknown>) ?? {}).length;
        for (const n of arch.nodes) {
            const c = n.controls as Record<string, unknown> | undefined;
            if (c) controlCount += Object.keys(c).length;
        }
        if (issues.length === 0) {
            issues.push({
                severity: 'info',
                message: controlCount === 0
                    ? `Valid — ${arch.nodes.length} node(s), but 0 controls found. Drop a building block that defines controls (e.g. "Microservice") onto a node, then Validate.`
                    : `Valid — checked ${arch.nodes.length} node(s) and ${controlCount} control(s); all requirements satisfied.`,
            });
        }
        store.setValidationIssues(issues);
        store.setShowValidation(true);
        // Annotate nodes with error/warning counts so validation badges appear on them.
        const counts: Record<string, { errors: number; warnings: number }> = {};
        for (const issue of issues) {
            if (!issue.nodeId) continue;
            const c = counts[issue.nodeId] ?? { errors: 0, warnings: 0 };
            if (issue.severity === 'error') c.errors++;
            else if (issue.severity === 'warning') c.warnings++;
            counts[issue.nodeId] = c;
        }
        setNodes(effectiveNodes.map((n) => ({
            ...n,
            data: { ...(n.data as Record<string, unknown>), validationErrors: counts[n.id]?.errors ?? 0, validationWarnings: counts[n.id]?.warnings ?? 0 },
        })));
    }, [nodes, edges, store, setNodes]);

    // --- Layout ---
    const handleLayout = useCallback((direction: 'DOWN' | 'RIGHT') => {
        if (!lastEmittedJson.current) return;
        try {
            const arch = JSON.parse(lastEmittedJson.current) as CalmArchitecture;
            if (!arch?.nodes?.length) return;
            const { nodes: laid, edges: parsedEdges } = parseCALMData(arch, direction);
            setNodes(laid); setEdges(parsedEdges);
            setTimeout(() => emitChange(true), 0);
        } catch { /* */ }
    }, [setNodes, setEdges, emitChange]);

    // --- Export SVG ---
    const handleExportSvg = useCallback(async () => {
        const viewport = containerRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null;
        if (!viewport) return;
        const bounds = getRectOfNodes(nodes);
        if (!bounds.width || !bounds.height) return;
        const margin = 40;
        const imageWidth = Math.ceil(bounds.width + margin * 2);
        const imageHeight = Math.ceil(bounds.height + margin * 2);
        try {
            const dataUrl = await toSvg(viewport, {
                width: imageWidth,
                height: imageHeight,
                style: {
                    width: `${imageWidth}px`,
                    height: `${imageHeight}px`,
                    transform: `translate(${margin - bounds.x}px, ${margin - bounds.y}px)`,
                },
            });
            // html-to-image returns a URI-encoded `data:image/svg+xml` URL; decode to raw SVG.
            let svgText = decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1));
            // Inject a full-cover background rect at the SVG root (unaffected by the inner
            // viewport transform) so the diagram has a solid backdrop and the light node
            // labels stay legible. Using html-to-image's `backgroundColor` gets transformed
            // with the content and produces a misplaced black box.
            const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--calm-bg').trim() || '#1e1e1e';
            svgText = svgText.replace(/(<svg[^>]*>)/, `$1<rect x="0" y="0" width="100%" height="100%" fill="${bgColor}"/>`);
            postMessage({ type: 'exportDiagram', format: 'svg', data: svgText });
        } catch (err) {
            console.error('SVG export failed', err);
        }
    }, [nodes]);

    // --- Issue click ---
    const handleIssueClick = useCallback((issue: { nodeId?: string; controlId?: string }) => {
        if (issue.nodeId) {
            const node = nodes.find((n) => n.id === issue.nodeId);
            if (node) {
                setSelectedNode(node);
                setSelectedEdge(null);
                store.selectNode(node.id);
            }
        } else {
            // Solution-level control — surface the solution controls panel.
            setSelectedNode(null);
            setSelectedEdge(null);
            store.selectNode(null);
        }
        if (issue.controlId) setExpandControlKey(issue.controlId);
    }, [nodes, store]);

    // --- Panel resize ---
    const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = panelWidth;
        const onMove = (ev: MouseEvent) => setPanelWidth(Math.max(220, Math.min(500, startWidth + (startX - ev.clientX))));
        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [panelWidth]);

    // --- Breadcrumb ---
    const handleBreadcrumbNavigate = useCallback((index: number) => {
        // index 0 = Root (editable); index N = the Nth drilled entry.
        // Read the target before popping so we can restore its file + readonly.
        const target = index > 0 ? store.drillStack[index - 1] : undefined;
        const readonly = target?.readonly ?? false;
        store.popDrill(index);
        store.setReadonlyMode(readonly);
        // Clear echo suppression so the returning model update gets through
        suppressFileUpdatesUntil.current = 0;
        notifyDrillUp(index, target?.filePath, readonly);
    }, [store]);

    // --- Edge update ---
    const onEdgeUpdate = useCallback((edgeId: string, field: string, value: unknown) => {
        setEdges((eds) => eds.map((e) => {
            if (e.id !== edgeId) return e;
            const data = { ...((e.data ?? {}) as Record<string, unknown>) };
            switch (field) {
                case 'calmVariant': data.calmVariant = value; break;
                case 'protocol': data.protocol = value; break;
                case 'description': data.description = value; break;
                case 'controls': data.controls = value; break;
                case 'direction': data.direction = value; break;
                case 'lineStyle': data.lineStyle = value; break;
                case 'routing': data.routing = value; break;
                case 'edgeMetadata': data.edgeMetadata = value; break;
            }
            const variant = (data.calmVariant as string) ?? 'connects';
            const STANDARD_VARIANTS = new Set(['connects', 'interacts', 'deployed-in', 'composed-of', 'options']);
            const customVariantLabel = !STANDARD_VARIANTS.has(variant) ? variant : '';
            const label = (data.protocol as string) || (data.description as string) || customVariantLabel;
            const direction = (data.direction as string) ?? 'source-to-target';
            const markerEnd = direction !== 'none'
                ? { type: MarkerType.ArrowClosed, width: 15, height: 15 }
                : undefined;
            const markerStart = direction === 'bidirectional'
                ? { type: MarkerType.ArrowClosed, width: 15, height: 15 }
                : undefined;
            const updated = { ...e, data, label, markerEnd, markerStart };
            setSelectedEdge(updated);
            return updated;
        }));
        setTimeout(() => emitChange(true), 0);
    }, [setEdges, emitChange]);

    // --- Edge reconnect (drag a wire endpoint onto a different handle to re-route) ---
    const handleEdgeReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
        if (store.readonlyMode) return;
        setEdges((els) => updateEdge(oldEdge, newConnection, els));
        setTimeout(() => emitChange(true), 0);
    }, [setEdges, emitChange, store.readonlyMode]);

    // --- Pattern/Template handlers ---
    const handlePatterns = useCallback(() => { setPatternPickerMode('new'); setShowPatternPicker(true); }, []);
    const handleApplyPattern = useCallback(() => { setPatternPickerMode('apply'); setShowPatternPicker(true); }, []);
    const handleTemplates = useCallback(() => setShowTemplatePicker(true), []);

    const handleArchApply = useCallback((arch: any, patternId?: string) => {
        if (patternId) {
            const metadata = (arch.metadata ?? {}) as Record<string, unknown>;
            const patterns = (metadata.patterns as string[]) ?? [];
            if (!patterns.includes(patternId)) patterns.push(patternId);
            metadata.patterns = patterns;
            arch.metadata = metadata;
        }
        const json = JSON.stringify(arch, null, 2);
        loadArchitecture(json);
        notifyCanvasChanged(json);
    }, [loadArchitecture]);

    const handlePatternMerge = useCallback((arch: any, patternId: string) => {
        const current = flowToCalm(nodes, edges, store.documentControls) as Record<string, unknown>;
        const currentNodes = (current.nodes as Array<Record<string, unknown>>) ?? [];
        const currentRels = (current.relationships as Array<Record<string, unknown>>) ?? [];
        const incomingNodes = (arch.nodes ?? []) as Array<Record<string, unknown>>;
        const incomingRels = (arch.relationships ?? []) as Array<Record<string, unknown>>;

        const existingNodeIds = new Set(currentNodes.map((n) => n['unique-id']));
        const existingRelIds = new Set(currentRels.map((r) => r['unique-id']));

        for (const n of incomingNodes) { if (!existingNodeIds.has(n['unique-id'])) currentNodes.push(n); }
        for (const r of incomingRels) { if (!existingRelIds.has(r['unique-id'])) currentRels.push(r); }

        current.nodes = currentNodes;
        current.relationships = currentRels;
        const metadata = (current.metadata ?? {}) as Record<string, unknown>;
        const patterns = (metadata.patterns as string[]) ?? [];
        if (!patterns.includes(patternId)) patterns.push(patternId);
        metadata.patterns = patterns;
        current.metadata = metadata;

        const json = JSON.stringify(current, null, 2);
        loadArchitecture(json);
        notifyCanvasChanged(json);
    }, [nodes, edges, store.documentControls, loadArchitecture]);

    // --- Control focused (standards panel) ---
    const handleControlFocused = useCallback((url: string | null) => {
        setActiveStandardProse(null);
        setActiveRequirementUrl(url);
        if (url) requestStandardProse(url);
    }, []);

    // --- Generate spec ---
    const handleGenerateSpec = useCallback(() => {
        notifyRequestGenerateSpec();
    }, []);

    if (!initialized) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--calm-fg-muted)' }}>Loading CALM architecture...</div>;
    }

    const data = selectedNode ? (selectedNode.data as Record<string, unknown>) : null;

    return (
        <div ref={containerRef} style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--calm-bg)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: 'var(--calm-fg)' }}>
            {/* Toolbar */}
            <div style={toolbarStyle}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--calm-fg)', marginRight: '12px', flex: '0 0 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>CALM Canvas</span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={() => handleLayout('DOWN')} className="fid-toolbar-btn" title="Top-to-bottom layout">↓ Layout</button>
                    <button onClick={() => handleLayout('RIGHT')} className="fid-toolbar-btn" title="Left-to-right layout">→ Layout</button>
                    <span className="fid-toolbar-sep" />
                    <button onClick={handleValidate} className="fid-toolbar-btn fid-toolbar-btn--validate">Validate</button>
                    {!store.readonlyMode && (
                        <button onClick={handleApplyPattern} className="fid-toolbar-btn fid-toolbar-btn--apply" title="Apply a pattern to the canvas">Apply Pattern</button>
                    )}
                    {!store.readonlyMode && (
                        <button onClick={handleGenerateSpec} className="fid-toolbar-btn fid-toolbar-btn--spec" title="Generate an architecture spec">Generate Spec</button>
                    )}
                    <button onClick={handleExportSvg} className="fid-toolbar-btn" title="Export the canvas as an SVG">Export SVG</button>
                    {!store.readonlyMode && (
                        <ToolbarMenu items={[
                            { label: 'Templates', onClick: handleTemplates },
                            { label: 'New from Pattern', onClick: handlePatterns },
                            { label: 'Create Node', onClick: () => setShowBuildingBlockCreator(true) },
                        ]} />
                    )}
                </div>
            </div>

            {/* Breadcrumb */}
            {store.drillStack.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', fontSize: '11px', background: 'var(--calm-bg-secondary)', borderBottom: '1px solid var(--calm-border)' }}>
                    <button onClick={() => handleBreadcrumbNavigate(0)} style={crumbStyle}>Root</button>
                    {store.drillStack.map((entry, idx) => (
                        <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: 'var(--calm-fg-muted)' }}>/</span>
                            <button onClick={() => handleBreadcrumbNavigate(idx + 1)} style={{ ...crumbStyle, ...(idx === store.drillStack.length - 1 ? { color: 'var(--calm-fg)', fontWeight: 600 } : {}) }}>{entry.label}</button>
                        </span>
                    ))}
                </div>
            )}

            {/* Readonly banner */}
            {store.readonlyMode && <div style={{ background: 'var(--vscode-editorWarning-foreground, #fbbf24)', color: 'var(--calm-bg)', textAlign: 'center', padding: '4px', fontSize: '11px', fontWeight: 600 }}>Building Block — Read Only</div>}

            {/* Main area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {!store.readonlyMode && <NodePalette buildingBlocks={store.buildingBlocks as any[]} />}

                <div style={{ flex: 1, position: 'relative' }} onDragOver={handleDragOver} onDrop={handleDrop}>
                    <ReactFlow
                        nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                        onConnect={onConnect} onNodesDelete={onNodesDelete}
                        onEdgeUpdate={store.readonlyMode ? undefined : handleEdgeReconnect}
                        edgeUpdaterRadius={20}
                        onNodeClick={handleNodeClick} onNodeDoubleClick={handleNodeDoubleClick}
                        onEdgeClick={handleEdgeClick}
                        onPaneClick={handlePaneClick} onNodeDragStop={handleNodeDragStop}
                        onDragOver={handleDragOver} onDrop={handleDrop}
                        fitView minZoom={0.1} maxZoom={4} panOnDrag
                        connectionMode={'loose' as any}
                        deleteKeyCode={store.readonlyMode ? null : ['Backspace', 'Delete']}
                        selectionKeyCode="Shift"
                    >
                        <Background />
                        <Controls />
                        <MiniMap />
                    </ReactFlow>

                    {/* Validation Panel */}
                    {store.showValidation && (
                        <div style={validationPanelStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--calm-border)' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--calm-fg)' }}>Validation Results</span>
                                <button onClick={() => store.setShowValidation(false)} style={{ border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '16px' }}>&times;</button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {store.validationIssues.length === 0 && <div style={{ padding: '12px 14px', color: 'var(--vscode-testing-iconPassed, #4ec9b0)', fontSize: '12px' }}>Architecture is valid</div>}
                                {store.validationIssues.map((issue, idx) => (
                                    <div key={idx} onClick={() => handleIssueClick(issue)} style={{ display: 'flex', gap: '8px', padding: '6px 14px', borderBottom: '1px solid var(--calm-border)', cursor: issue.nodeId ? 'pointer' : 'default' }}>
                                        <span style={{ color: issue.severity === 'error' ? 'var(--vscode-editorError-foreground, #f14c4c)' : issue.severity === 'warning' ? 'var(--vscode-editorWarning-foreground, #cca700)' : 'var(--vscode-testing-iconPassed, #4ec9b0)', fontSize: '12px' }}>{issue.severity === 'error' ? '⊘' : issue.severity === 'warning' ? '⚠' : '✓'}</span>
                                        <div><div style={{ fontSize: '11px', color: 'var(--calm-fg)' }}>{issue.message}</div>{issue.nodeId && <div style={{ fontSize: '10px', color: 'var(--calm-fg-muted)', fontFamily: 'monospace' }}>Node: {issue.nodeId}</div>}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Properties panel */}
                {panelCollapsed ? (
                    <button onClick={() => setPanelCollapsed(false)} title="Show properties panel" style={collapsedPanelStyle}>
                        <span style={{ fontSize: '13px', color: 'var(--calm-fg)' }}>‹</span>
                        <span style={collapsedLabelStyle}>PROPERTIES</span>
                    </button>
                ) : (
                    <div style={{ width: `${panelWidth}px`, minWidth: `${panelWidth}px`, display: 'flex', flexDirection: 'row', maxHeight: '100%', overflow: 'hidden' }}>
                        <div onMouseDown={handlePanelResizeStart} className="fid-resize-handle" title="Drag to resize" />
                        <div style={{ flex: 1, overflowY: 'auto', borderLeft: '1px solid var(--calm-border)', background: 'var(--calm-bg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--calm-border)' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--calm-fg)' }}>PROPERTIES</span>
                                <button onClick={() => setPanelCollapsed(true)} title="Collapse panel" style={collapseToggleStyle}>›</button>
                            </div>
                            {selectedEdge && !selectedNode ? (
                                <EdgeProperties edge={selectedEdge} readonlyMode={store.readonlyMode} onEdgeUpdate={onEdgeUpdate} />
                            ) : selectedNode && data ? (
                                <>
                                    <div style={{ padding: '12px' }}>
                                        <Field label="ID"><span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 }}>{data.calmId as string ?? selectedNode.id}</span></Field>
                                        <Field label="Name">
                                            <input type="text" defaultValue={String(data.label ?? '')} key={`${selectedNode.id}-name`}
                                                onBlur={(e) => onNodeUpdate(selectedNode.id, 'name', e.target.value)} style={inputStyle} readOnly={store.readonlyMode} />
                                        </Field>
                                        <Field label="Type"><span style={{ fontSize: '12px', color: 'var(--calm-fg)' }}>{data.calmType as string ?? 'system'}</span></Field>
                                        <Field label="Description">
                                            <textarea defaultValue={String(data.description ?? '')} key={`${selectedNode.id}-desc`}
                                                onBlur={(e) => onNodeUpdate(selectedNode.id, 'description', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} readOnly={store.readonlyMode} />
                                        </Field>
                                        {selectedNode.parentId && !store.readonlyMode && (
                                            <button onClick={() => unparentNode(selectedNode.id)} style={unparentBtnStyle}>Remove from Container</button>
                                        )}
                                    </div>
                                    <InterfaceList
                                        interfaces={(data.interfaces as any[]) ?? []}
                                        onUpdate={(ifaces) => onNodeUpdate(selectedNode.id, 'interfaces', ifaces)}
                                        readonly={store.readonlyMode}
                                    />
                                    <ControlsList
                                        controls={data.controls as any}
                                        onUpdate={(ctrls) => onNodeUpdate(selectedNode.id, 'controls', ctrls)}
                                        readonly={store.readonlyMode}
                                        valueOnly={!!(data.metadata as any)?.['source-building-block']}
                                        expandControl={expandControlKey}
                                        onControlFocused={handleControlFocused}
                                    />
                                    <NodeAppearance
                                        key={`${selectedNode.id}-appearance`}
                                        style={getNodeStyleOverride(data as Record<string, unknown>)}
                                        onUpdate={(style) => {
                                            const meta = { ...((data.metadata as Record<string, unknown>) ?? {}) };
                                            if (style) {
                                                meta['building-block-style'] = style;
                                            } else {
                                                delete meta['building-block-style'];
                                            }
                                            onNodeUpdate(selectedNode.id, 'metadata', meta);
                                        }}
                                        readonly={store.readonlyMode}
                                    />
                                    <CustomMetadata
                                        metadata={(data.metadata as Record<string, string>) ?? {}}
                                        onUpdate={(meta) => onNodeUpdate(selectedNode.id, 'metadata', meta)}
                                        readonly={store.readonlyMode}
                                    />
                                </>
                            ) : (
                                <div style={{ padding: '12px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '8px' }}>Solution Controls</div>
                                    <ControlsList
                                        controls={store.documentControls as any}
                                        onUpdate={(ctrls) => { useCanvasStore.setState({ documentControls: ctrls }); setTimeout(() => emitChange(true), 0); }}
                                        readonly={store.readonlyMode}
                                        valueOnly={false}
                                        expandControl={expandControlKey}
                                        onControlFocused={handleControlFocused}
                                    />
                                    {(!store.documentControls || Object.keys(store.documentControls).length === 0) && (
                                        <p style={{ fontSize: '11px', color: 'var(--calm-fg-muted)', textAlign: 'center', padding: '20px 0' }}>No solution-level controls. Select a node or drop a standard here.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Standards Panel */}
            {activeRequirementUrl && (
                <StandardsPanel
                    requirementUrl={activeRequirementUrl}
                    prose={activeStandardProse}
                    onClose={() => { setActiveRequirementUrl(null); setActiveStandardProse(null); }}
                />
            )}

            {/* Pattern Picker */}
            <PatternPicker
                visible={showPatternPicker}
                mode={patternPickerMode}
                patterns={store.loadedPatterns as any[]}
                onApply={(arch, patternId) => {
                    if (patternPickerMode === 'apply') handlePatternMerge(arch, patternId);
                    else handleArchApply(arch, patternId);
                }}
                onClose={() => setShowPatternPicker(false)}
            />

            {/* Template Picker */}
            <TemplatePicker
                visible={showTemplatePicker}
                templates={store.loadedTemplates as any[]}
                onApply={handleArchApply}
                onClose={() => setShowTemplatePicker(false)}
            />

            {/* Building Block Creator */}
            <BuildingBlockCreator
                visible={showBuildingBlockCreator}
                onClose={() => setShowBuildingBlockCreator(false)}
                onSave={(json, fileName) => notifySaveBuildingBlock(fileName, json)}
            />
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '4px' }}>{label}</div>{children}</div>;
}

const toolbarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '6px 12px', background: 'var(--calm-bg-secondary)', borderBottom: '1px solid var(--calm-border)', flexShrink: 0 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', fontSize: '12px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none', fontFamily: 'inherit' };
const validationPanelStyle: React.CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '40%', display: 'flex', flexDirection: 'column', background: 'var(--calm-bg)', borderTop: '1px solid var(--calm-border-heavy)', zIndex: 100, boxShadow: '0 -2px 8px rgba(0,0,0,0.3)' };
const collapsedPanelStyle: React.CSSProperties = { width: '30px', minWidth: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0', border: 'none', borderLeft: '1px solid var(--calm-border)', background: 'var(--calm-bg-secondary)', cursor: 'pointer' };
const collapsedLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'var(--calm-fg-muted)', writingMode: 'vertical-rl', letterSpacing: '1px' };
const collapseToggleStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px' };
const crumbStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-link)', fontSize: '11px', padding: '2px 4px' };
const unparentBtnStyle: React.CSSProperties = { marginTop: '8px', padding: '4px 10px', fontSize: '11px', color: 'var(--calm-link)', background: 'none', border: '1px solid var(--calm-link)', borderRadius: '4px', cursor: 'pointer' };

export function App() {
    return <ReactFlowProvider><CanvasApp /></ReactFlowProvider>;
}
