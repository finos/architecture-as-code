import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
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
    type Node,
    type Edge,
    type Connection,
    type NodeChange,
    type EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useCanvasStore } from './stores/canvas-store';
import {
    initBridge,
    setModelUpdateCallback,
    setPatternsLoadedCallback,
    setStandardNodesLoadedCallback,
    setHubLoadingCallback,
    setDrillResultCallback,
    setDefinitionResolvedCallback,
    setDefinitionResolutionFailedCallback,
    setControlsChangedCallback,
    notifyCanvasChanged,
    notifyDrillInto,
    notifyDrillUp,
    requestControlResolve,
} from './stores/sync-bridge';
import { postMessage } from './vscode-api';
import {
    flowToCalm,
    relayoutByPath,
    setLastParsedArch,
    applyLayoutFromMetadata,
    type CalmArchitecture,
} from './transforms/calm-editor-transformer';
import { parseCALMData } from './transforms/calm-parser';
import { updateInstances, hasSharedDrawings, pathOf } from './transforms/node-instances';
import { resolveLiveSelectedNode } from './utils/live-selected-node';
import { deleteDrawings, unparentDrawing, pastedNode, originalsOf } from './transforms/canvas-edits';
import { NodePalette } from './panels/NodePalette';
import { EdgeProperties } from './panels/EdgeProperties';
import { InterfaceList } from './panels/InterfaceList';
import { CustomMetadata } from './panels/CustomMetadata';
import {
    type ControlEntry,
    enrichControlWithRequirement,
    getRequirementUrl,
    needsEnrichment,
} from './panels/control-metadata';
import { isControlRef, isLocalControlPath } from '../extension/services/control-curie';
import { nodeTypes } from './canvas/nodeTypes';
import { edgeTypes } from './canvas/edgeTypes';
import { minimapNodeClassName } from './canvas/minimap';
import { makeContainment, getAbsolutePosition, containerAt } from './utils/containment';
import { createPaletteNodeFromDrop, resolveFlowNodeType } from './canvas/node-drop';
import { CanvasToolbar } from './features/CanvasToolbar';
import { dispatchFeatureDrop, getEnabledFeatureDefinitions, getEnabledNodeTypes, notifyRelationshipsDeleted, resolveEnabledFeatures, transformCanvasView } from './features/registry';
import type { CanvasFeatureDropContext } from './features/types';
import { CanvasFeatureSlot } from './features/CanvasFeatureSlot';
import { useFeatureRuntimeRevision } from './features/runtime-invalidation';

const SUPPRESS_ECHO_MS = 1200;
function isInputDOMNode(e: KeyboardEvent): boolean {
    const tag = (e.target as HTMLElement)?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable === true;
}

function getInitialCalmJson(): string | undefined {
    return (window as unknown as { __INITIAL_CALM_JSON__?: string }).__INITIAL_CALM_JSON__;
}

function CanvasApp() {
    const containerRef = useRef<HTMLDivElement>(null);
    const store = useCanvasStore();
    useFeatureRuntimeRevision();
    const [enabledCanvasFeatures] = useState(() => resolveEnabledFeatures(
        (window as unknown as { __CALM_ENABLED_FEATURES__?: string[] }).__CALM_ENABLED_FEATURES__
    ));
    const activeNodeTypes = useMemo(
        () => getEnabledNodeTypes(enabledCanvasFeatures, nodeTypes),
        [enabledCanvasFeatures],
    );
    const reactFlowInstance = useReactFlow();
    const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState([]);
    const [initialized, setInitialized] = useState(() => !!getInitialCalmJson());
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
    // Where the selected drawing is. A load can give the drawing at that place another id, or give its id to another drawing.
    const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
    const selectDrawing = useCallback((node: Node) => {
        setSelectedNode(node);
        setSelectedPlace(pathOf(node, new Map(reactFlowInstance.getNodes().map((n) => [n.id, n]))));
    }, [reactFlowInstance]);
    const [panelWidth, setPanelWidth] = useState(280);
    const [panelCollapsed, setPanelCollapsed] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; edge: Edge } | null>(null);
    const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
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
    const pendingNodesRef = useRef<Node[] | null>(null);
    // React Flow calls onEdgesChange for the edges of deleted drawings, then onNodesDelete, then onNodesChange
    // with a remove change for each deleted drawing. A delete that reloads the canvas saves the file itself,
    // and the drawings it keeps must not be removed.
    const reloadPending = useRef(false);
    const keptOnDelete = useRef<Set<string> | null>(null);
    const pendingNodeDelete = useRef(false);

    // Fresh refs for nodes/edges — used by emitChange when ReactFlow is unmounted (sequence mode)
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [nodes, edges]);

    // Copy/paste
    const clipboardNode = useRef<Node | null>(null);


    // --- Core: emit change ---
    const emitChange = useCallback((immediate = false, forReload = false) => {
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
            const currentNodes = pendingNodesRef.current ?? nodesRef.current;
            pendingNodesRef.current = null;
            const currentEdges = edgesRef.current;
            const arch = flowToCalm(currentNodes, currentEdges, currentState.documentControls, currentState.flows);
            if (forReload) (arch.metadata as Record<string, unknown>)._layout = relayoutByPath(arch, currentNodes);
            const json = JSON.stringify(arch, null, 2);
            lastEmittedJson.current = json;
            notifyCanvasChanged(json);
            suppressFileUpdatesUntil.current = Date.now() + SUPPRESS_ECHO_MS;
        };

        if (immediate) flush();
        else debounceTimer.current = setTimeout(flush, 300);
    }, [store.readonlyMode]);

    // --- Control enrichment (webview-driven) ---
    // Resolve each control's requirement to attach validation metadata and seed
    // base identity constants. Local refs always re-resolve (the file may have
    // changed); Hub refs only when not yet enriched. All updates are guarded by
    // the load generation so stale resolves from a prior document are discarded.
    const updateNodeControl = useCallback((nodeId: string, ckey: string, enrich: (c: ControlEntry) => ControlEntry) => {
        setNodes((nds) => updateInstances(nds, nodeId, (n) => {
            const data = n.data as Record<string, unknown>;
            const existing = (data.controls as Record<string, ControlEntry>) ?? {};
            const target = existing[ckey];
            if (!target) return n;
            return { ...n, data: { ...data, controls: { ...existing, [ckey]: enrich(target) } } };
        }));
    }, [setNodes]);

    const updateDocControl = useCallback((ckey: string, enrich: (c: ControlEntry) => ControlEntry) => {
        const latest = (useCanvasStore.getState().documentControls as Record<string, ControlEntry>) ?? {};
        const target = latest[ckey];
        if (!target) return;
        useCanvasStore.setState({ documentControls: { ...latest, [ckey]: enrich(target) } });
    }, []);

    const resolveAndEnrich = useCallback((
        controls: Record<string, ControlEntry>,
        generation: number,
        apply: (ckey: string, enrich: (c: ControlEntry) => ControlEntry) => void
    ) => {
        for (const [ckey, ctrl] of Object.entries(controls)) {
            const ref = getRequirementUrl(ctrl);
            if (!ref || !isControlRef(ref)) continue;
            const local = isLocalControlPath(ref);
            if (!needsEnrichment(ctrl) && !local) continue;
            requestControlResolve(ref, (result) => {
                if (generation !== loadGeneration.current) {
                    console.warn(`[CALM] Control resolve for ${ref} discarded: generation ${generation} !== ${loadGeneration.current}`);
                    return;
                }
                if (!result.ok) {
                    console.warn(`[CALM] Control resolve failed for ${ref}: ${result.error}`);
                    return;
                }
                console.log(`[CALM] Control resolved for ${ref}: ${Object.keys(result.parsed.properties).length} properties`);
                apply(ckey, (c) => enrichControlWithRequirement(c, result.parsed));
            });
        }
    }, []);

    const enrichNodeControls = useCallback((nodeList: Node[], generation: number) => {
        for (const node of nodeList) {
            const controls = (node.data as Record<string, unknown>)?.controls as Record<string, ControlEntry> | undefined;
            if (controls && Object.keys(controls).length > 0) {
                resolveAndEnrich(controls, generation, (ckey, enrich) => updateNodeControl(node.id, ckey, enrich));
            }
        }
    }, [resolveAndEnrich, updateNodeControl]);

    const enrichAllControls = useCallback((nodeList: Node[], generation: number) => {
        enrichNodeControls(nodeList, generation);
        const docControls = (useCanvasStore.getState().documentControls as Record<string, ControlEntry>) ?? {};
        resolveAndEnrich(docControls, generation, (ckey, enrich) => updateDocControl(ckey, enrich));
    }, [enrichNodeControls, resolveAndEnrich, updateDocControl]);

    // --- Load architecture ---
    const loadArchitecture = useCallback((json: string) => {
        // Invalidate any in-flight setTimeout callbacks from prior interactions
        loadGeneration.current++;
        // Cancel any pending emit timers to prevent stale data from overwriting the file
        if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
        if (positionDebounceTimer.current) { clearTimeout(positionDebounceTimer.current); positionDebounceTimer.current = null; }
        pendingNodesRef.current = null;

        // A blank/whitespace file means "no architecture" — clear the canvas instead of
        // keeping the previously loaded diagram (JSON.parse('') would otherwise throw and the
        // stale nodes would linger).
        if (!json || json.trim() === '') {
            setNodes([]); setEdges([]); setLastParsedArch(null);
            useCanvasStore.setState({ documentControls: {}, copiesLimited: false });
            useCanvasStore.getState().setFlows([]);
            lastEmittedJson.current = json;
            return;
        }
        try {
            const arch = JSON.parse(json) as CalmArchitecture;
            if (!arch || !arch.nodes || arch.nodes.length === 0) {
                setNodes([]); setEdges([]); setLastParsedArch(null);
                useCanvasStore.setState({ documentControls: (arch as Record<string, unknown>)?.controls as Record<string, unknown> ?? {}, copiesLimited: false });
                useCanvasStore.getState().setFlows(arch?.flows ?? []);
                lastEmittedJson.current = json;
                return;
            }
            setLastParsedArch(arch);

            const { nodes: parsedNodes, edges: parsedEdges, copiesLimited } = parseCALMData(arch);
            useCanvasStore.setState({ documentControls: (arch as Record<string, unknown>).controls as Record<string, unknown> ?? {}, copiesLimited });
            const parsedFlows = (arch.flows ?? []) as CalmFlow[];
            const metadata = (arch as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
            const layoutedNodes = applyLayoutFromMetadata(parsedNodes, metadata);
            setNodes(layoutedNodes);
            setEdges(parsedEdges);
            useCanvasStore.getState().setFlows(parsedFlows);
            lastEmittedJson.current = json;
            // Request resolution for any nodes with definition-id references, once per CALM node:
            // the result is applied to every drawing of it
            const originals = originalsOf(layoutedNodes);
            for (const node of originals) {
                const defId = (node.data as Record<string, unknown>)?.['definition-id'] as string | undefined;
                if (defId) {
                    postMessage({ type: 'resolveDefinitionId', nodeId: node.id, curie: defId });
                }
            }
            // Enrich controls with resolved requirement metadata (covers initial
            // load, drill, file-watcher, SVG import, undo/redo). Both node-level and
            // document-level controls are scanned; local refs always re-resolve.
            const generation = loadGeneration.current;
            setTimeout(() => enrichAllControls(originals, generation), 0);
        } catch (err) {
            console.error('[CALM Canvas] Failed to load architecture:', err);
        }
    }, [setNodes, setEdges, enrichAllControls]);

    // After an edit that changes which drawings a node has, rebuild the canvas from the file,
    // so every drawing of a container shows the same members
    const emitAndReload = useCallback(() => {
        const before = lastEmittedJson.current;
        emitChange(true, true);
        if (lastEmittedJson.current && lastEmittedJson.current !== before) loadArchitecture(lastEmittedJson.current);
    }, [emitChange, loadArchitecture]);

    // --- Bridge setup ---
    useEffect(() => {
        setModelUpdateCallback((json, source) => {
            if (source === 'file') {
                if (Date.now() < suppressFileUpdatesUntil.current) return;
                if (lastEmittedJson.current && json === lastEmittedJson.current) return;
                if (debounceTimer.current) {
                    clearTimeout(debounceTimer.current);
                    debounceTimer.current = null;
                }
            }
            loadArchitecture(json);
            setInitialized(true);
        });
        setPatternsLoadedCallback((p) => useCanvasStore.setState({ loadedPatterns: p }));
        setHubLoadingCallback((loading) => useCanvasStore.setState({ hubLoading: loading }));
        setStandardNodesLoadedCallback((n) => useCanvasStore.setState({ standardNodes: n }));
        setDrillResultCallback((json, label, _filePath, readonly) => {
            undoStack.current = [];
            redoStack.current = [];
            setSelectedNode(null);
            setSelectedEdge(null);
            store.selectNode(null);
            store.selectEdge(null);
            store.setValidationIssues([]);
            store.setShowValidation(false);
            store.pushDrill({ label, filePath: _filePath, readonly });
            store.setReadonlyMode(readonly ?? false);
            loadArchitecture(json);
        });
        setDefinitionResolvedCallback((nodeId, controls) => {
            setNodes((nds) => updateInstances(nds, nodeId, (n) => {
                const data = n.data as Record<string, unknown>;
                // Only set controls if node doesn't already have them (from saved file)
                const existingControls = data.controls as Record<string, unknown> | undefined;
                const hasExisting = existingControls && Object.keys(existingControls).length > 0;
                return { ...n, data: { ...data, controls: hasExisting ? existingControls : controls, _resolvedControls: controls } };
            }));
            // Enrich the freshly-resolved controls once React has committed them.
            const generation = loadGeneration.current;
            setTimeout(() => {
                if (generation !== loadGeneration.current) return;
                const n = reactFlowInstance.getNodes().find((x) => x.id === nodeId);
                if (n) enrichNodeControls([n], generation);
            }, 0);
        });
        setDefinitionResolutionFailedCallback((nodeId, error) => {
            console.warn(`[CALM Canvas] Failed to resolve definition for node ${nodeId}: ${error}`);
        });
        setControlsChangedCallback(() => {
            // A local requirement file changed — re-resolve all controls.
            const generation = loadGeneration.current;
            enrichAllControls(reactFlowInstance.getNodes(), generation);
        });
        initBridge();

        const initialJson = getInitialCalmJson();
        if (initialJson) loadArchitecture(initialJson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadArchitecture, setNodes]);

    // --- Unparent ---
    const unparentNode = useCallback((nodeId: string) => {
        const edit = unparentDrawing(nodes, edges, nodeId);
        setNodes(edit.nodes);
        setEdges(edit.edges);
        setTimeout(() => (edit.reload ? emitAndReload() : emitChange(true)), 0);
    }, [nodes, edges, setNodes, setEdges, emitChange, emitAndReload]);

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
            if ((e.ctrlKey || e.metaKey) && ((e.shiftKey && e.key.toLowerCase() === 'z') || (!e.shiftKey && e.key === 'y'))) {
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
                const live = resolveLiveSelectedNode(selectedNode, nodes, selectedPlace);
                if (live?.parentId) unparentNode(live.id);
            }
            // Copy
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey && !isInputDOMNode(e)) {
                const live = resolveLiveSelectedNode(selectedNode, nodes, selectedPlace);
                if (live) {
                    clipboardNode.current = live;
                }
            }
            // Paste
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey && !isInputDOMNode(e)) {
                if (store.readonlyMode || !clipboardNode.current) return;
                e.preventDefault();
                const src = clipboardNode.current;
                const calmType = ((src.data as Record<string, unknown>)?.calmType as string) ?? 'system';
                const newId = `${calmType.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}`;
                const newNode = pastedNode(src, newId);
                setNodes((nds) => [...nds, newNode]);
                selectDrawing(newNode);
                store.selectNode(newId);
                setTimeout(() => emitChange(true), 0);
            }
        };
        window.addEventListener('keydown', handleKeydown);
        return () => window.removeEventListener('keydown', handleKeydown);
    }, [loadArchitecture, selectedNode, selectedPlace, selectDrawing, nodes, setNodes, emitChange, store, unparentNode]);

    // --- Node changes (position, dimension, remove) ---
    const onNodesChange = useCallback((changes: NodeChange[]) => {
        if (store.readonlyMode) {
            const safe = changes.filter((c) => c.type === 'select' || c.type === 'dimensions');
            if (safe.length > 0) onNodesChangeBase(safe);
            return;
        }
        const kept = keptOnDelete.current;
        keptOnDelete.current = null;
        onNodesChangeBase(kept ? changes.filter((c) => c.type !== 'remove' || !kept.has(c.id)) : changes);

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
        if (structural) setTimeout(() => {
            if (pendingNodeDelete.current) {
                pendingNodeDelete.current = false;
                return;
            }
            if (!reloadPending.current) emitChange(true);
        }, 0);
        else if (hasDimensions) {
            if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
            positionDebounceTimer.current = setTimeout(() => emitChange(true), 800);
        }
    }, [onNodesChangeBase, emitChange, store.readonlyMode]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        if (store.readonlyMode) return;
        onEdgesChangeBase(changes);
        const removals = changes.filter((c) => c.type === 'remove');
        if (removals.length > 0) {
            const removedEdgeIds = new Set(removals.map(c => c.id));
            const removedEdges = edgesRef.current.filter((edge) => removedEdgeIds.has(edge.id));
            setTimeout(() => {
                if (pendingNodeDelete.current) return;
                const remainingRelIds = new Set(edgesRef.current.flatMap((edge) => {
                    const data = (edge.data ?? {}) as Record<string, unknown>;
                    return [data.calmRelId, data.calmReverseRelId].filter((id): id is string => typeof id === 'string');
                }));
                const deletedRelIds = new Set<string>();
                for (const edge of removedEdges) {
                    const data = (edge.data ?? {}) as Record<string, unknown>;
                    for (const id of [data.calmRelId, data.calmReverseRelId]) {
                        if (typeof id === 'string' && !remainingRelIds.has(id)) deletedRelIds.add(id);
                    }
                }
                if (deletedRelIds.size > 0) notifyRelationshipsDeleted(enabledCanvasFeatures, deletedRelIds);
                if (!reloadPending.current) emitChange(true);
            }, 0);
        }
    }, [enabledCanvasFeatures, onEdgesChangeBase, emitChange, store.readonlyMode]);

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
            style: { strokeWidth: 1.5 },
            data: { calmRelId: id, calmVariant: 'connects', protocol: '', description: '', direction: 'source-to-target', lineStyle: 'solid' },
        }, eds));
        setTimeout(() => emitChange(true), 0);
    }, [setEdges, emitChange, store.readonlyMode]);

    // --- Delete ---
    const onNodesDelete = useCallback((deletedNodes: Node[]) => {
        if (store.readonlyMode) return;
        const edit = deleteDrawings(nodes, edges, deletedNodes);
        const deletedIds = new Set(deletedNodes.map((n) => n.id));
        pendingNodeDelete.current = edit.reload;
        keptOnDelete.current = new Set(edit.nodes.map((n) => n.id));
        const selected = resolveLiveSelectedNode(selectedNode, nodes, selectedPlace);
        if (selected && !edit.nodes.some((n) => n.id === selected.id)) setSelectedNode(null);
        setNodes(edit.nodes);
        // React Flow has already removed the picked edges and the edges of the deleted drawings.
        // The edit decides on the edges of the drawings only: some stay, or move to another drawing.
        // A box selection also selects those edges, so a selected edge is not always a picked one.
        const decided = new Set(edges.filter((e) => deletedIds.has(e.source) || deletedIds.has(e.target)).map((e) => e.id));
        setEdges((eds) => {
            const live = new Set(eds.map((e) => e.id));
            return edit.edges.filter((e) => live.has(e.id) || decided.has(e.id));
        });
        const removedRelIds = new Set<string>();
        const remainingRelIds = new Set(edit.edges.flatMap((edge) => {
            const data = (edge.data ?? {}) as Record<string, unknown>;
            return [data.calmRelId, data.calmReverseRelId].filter((id): id is string => typeof id === 'string');
        }));
        for (const e of edgesRef.current) {
            if (deletedIds.has(e.source) || deletedIds.has(e.target)) {
                const d = (e.data ?? {}) as Record<string, unknown>;
                if (typeof d.calmRelId === 'string' && !remainingRelIds.has(d.calmRelId)) removedRelIds.add(d.calmRelId);
                if (typeof d.calmReverseRelId === 'string' && !remainingRelIds.has(d.calmReverseRelId)) removedRelIds.add(d.calmReverseRelId);
            }
        }
        if (removedRelIds.size > 0) notifyRelationshipsDeleted(enabledCanvasFeatures, removedRelIds);
        if (!edit.reload) {
            setTimeout(() => emitChange(true), 0);
            return;
        }
        reloadPending.current = true;
        setTimeout(() => {
            emitAndReload();
            // After the saves that React Flow's change callbacks queued for this delete
            setTimeout(() => { reloadPending.current = false; }, 0);
        }, 0);
    }, [enabledCanvasFeatures, nodes, edges, selectedNode, selectedPlace, setNodes, setEdges, emitChange, emitAndReload, store.readonlyMode]);

    // --- Node click (select) ---
    const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
        selectDrawing(node);
        setSelectedEdge(null);
        store.selectNode(node.id);
    }, [store, selectDrawing]);

    // --- Node double-click (drill-in or select+focus) ---
    const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
        const data = node.data as Record<string, unknown>;
        const details = data?.details as { 'detailed-architecture'?: string } | undefined;
        const calmType = (data?.calmType as string) ?? '';
        const label = (data?.label as string) || node.id;
        const metadata = data?.metadata as Record<string, unknown> | undefined;
        const sourceStandardNode = metadata?.['source-standard-node'] as string | undefined;

        if (details?.['detailed-architecture'] || sourceStandardNode || calmType.includes(':')) {
            loadGeneration.current++;
            if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
            if (positionDebounceTimer.current) { clearTimeout(positionDebounceTimer.current); positionDebounceTimer.current = null; }
            pendingNodesRef.current = null;
            if (details?.['detailed-architecture']) {
                notifyDrillInto(label, details['detailed-architecture'], calmType);
            } else if (sourceStandardNode) {
                notifyDrillInto(label, `standard-nodes/${sourceStandardNode}.calm.json`, `standard-node:${sourceStandardNode}`);
            } else {
                const safeName = calmType.replace(/^standard-node:/, '');
                notifyDrillInto(label, `standard-nodes/${safeName}.calm.json`, calmType);
            }
        } else {
            // No drill target — select and focus the name field for editing
            selectDrawing(node);
            store.selectNode(node.id);
        }
    }, [store, selectDrawing]);

    const handleEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
        setSelectedEdge(edge);
        setSelectedNode(null);
        store.selectEdge(edge.id);
    }, [store]);

    const handlePaneClick = useCallback(() => {
        setSelectedNode(null); setSelectedEdge(null);
        store.selectNode(null); store.selectEdge(null);
        setContextMenu(null);
        setNodeContextMenu(null);
    }, [store]);

    // --- Node role context menu ---

    const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
        event.preventDefault();
        if (store.readonlyMode) return;
        setNodeContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }, [store.readonlyMode]);

    // --- Flow context menu ---

    const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
        event.preventDefault();
        if (store.readonlyMode) return;
        setContextMenu({ x: event.clientX, y: event.clientY, edge });
    }, [store.readonlyMode]);

    // --- Node drag stop (containment detection) ---
    const handleNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
        if (store.readonlyMode) return;
        if (draggedNode.type === 'container' || draggedNode.parentId) {
            if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
            positionDebounceTimer.current = setTimeout(() => emitChange(true), 0);
            return;
        }

        const container = containerAt(getAbsolutePosition(draggedNode, nodes), nodes);
        if (container) setNodes((nds) => makeContainment(container.id, draggedNode.id, nds));
        // A new member of a container with several drawings is drawn in each after a rebuild
        if (positionDebounceTimer.current) clearTimeout(positionDebounceTimer.current);
        positionDebounceTimer.current = setTimeout(() => (container && hasSharedDrawings(nodes) ? emitAndReload() : emitChange(true)), 0);
    }, [nodes, setNodes, emitChange, emitAndReload, store.readonlyMode]);

    // --- Node update (from properties panel) ---
    const onNodeUpdate = useCallback((nodeId: string, field: string, value: unknown) => {
        setNodes((nds) => {
            const result = updateInstances(nds, nodeId, (n) => {
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
                if (n.id === nodeId) setSelectedNode(updated);
                return updated;
            });
            pendingNodesRef.current = result;
            return result;
        });
        setTimeout(() => emitChange(field !== 'name' && field !== 'description'), 0);
    }, [setNodes, emitChange]);

    // Expose capabilities, not feature IDs, so core composition stays independent of bundled modules.
    const featureRuntime = {
        readonlyMode: store.readonlyMode,
        nodes,
        edges,
        selectedNode,
        selectedEdge,
        expandControlKey,
        contextMenu,
        setContextMenu,
        nodeContextMenu,
        setNodeContextMenu,
        containerRef,
        setSelectedNode,
        setSelectedEdge,
        setExpandControlKey,
        setNodes,
        setEdges,
        updateNode: onNodeUpdate,
        getCurrentNodes: () => nodesRef.current,
        getCurrentEdges: () => edgesRef.current,
        enrichNodeControls: (nodeList: Node[]) => enrichNodeControls(nodeList, loadGeneration.current),
        enrichAllControls: () => enrichAllControls(reactFlowInstance.getNodes(), loadGeneration.current),
        emitChange,
        postMessage: (message: unknown) => postMessage(message as any),
        loadArchitecture,
    };

    // --- Drop from palette ---
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (store.readonlyMode) return;

        const dropContext: CanvasFeatureDropContext = {
            readonlyMode: store.readonlyMode,
            nodes,
            edges,
            setNodes,
            setEdges,
            getCurrentNodes: () => nodesRef.current,
            enrichNodeControls: (nodeList) => enrichNodeControls(nodeList, loadGeneration.current),
            enrichAllControls: () => enrichAllControls(reactFlowInstance.getNodes(), loadGeneration.current),
            emitChange,
            postMessage: (message) => postMessage(message as any),
            clientX: e.clientX,
            clientY: e.clientY,
            screenToFlowPosition: (position) => reactFlowInstance.screenToFlowPosition(position),
            dataTransfer: e.dataTransfer,
        };
        if (dispatchFeatureDrop(enabledCanvasFeatures, dropContext)) return;

        const nodeType = e.dataTransfer.getData('application/calm-node-type');
        const nodeLabel = e.dataTransfer.getData('application/calm-node-label');
        const isContainer = e.dataTransfer.getData('application/calm-container') === 'true';
        const position = reactFlowInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        if (!nodeType) return;
        const newNode = createPaletteNodeFromDrop({ nodeType, nodeLabel, isContainer, position });
        setNodes((nds) => [...nds, newNode]);
        setTimeout(() => emitChange(true), 0);
    }, [edges, enabledCanvasFeatures, emitChange, enrichAllControls, enrichNodeControls, nodes, reactFlowInstance, setEdges, setNodes, store.readonlyMode]);

    // --- Layout ---
    const handleLayout = useCallback((direction: 'DOWN' | 'RIGHT') => {
        if (!lastEmittedJson.current) return;
        try {
            const arch = JSON.parse(lastEmittedJson.current) as CalmArchitecture;
            if (!arch?.nodes?.length) return;
            const { nodes: laid, edges: parsedEdges, copiesLimited } = parseCALMData(arch, direction);
            setNodes(laid); setEdges(parsedEdges);
            useCanvasStore.setState({ copiesLimited });
            useCanvasStore.getState().setFlows((arch.flows ?? []) as CalmFlow[]);
            setTimeout(() => emitChange(true), 0);
        } catch { /* */ }
    }, [setNodes, setEdges, emitChange]);

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
        loadGeneration.current++;
        if (debounceTimer.current) { clearTimeout(debounceTimer.current); debounceTimer.current = null; }
        if (positionDebounceTimer.current) { clearTimeout(positionDebounceTimer.current); positionDebounceTimer.current = null; }
        pendingNodesRef.current = null;
        undoStack.current = [];
        redoStack.current = [];
        setSelectedNode(null);
        setSelectedEdge(null);
        store.selectNode(null);
        store.selectEdge(null);
        store.setValidationIssues([]);
        store.setShowValidation(false);
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
            const rawLabel = (data.protocol as string) || (data.description as string) || customVariantLabel;
            const label = rawLabel && rawLabel.length > 30 ? rawLabel.slice(0, 30) + '...' : rawLabel;
            const direction = (data.direction as string) ?? 'source-to-target';
            const arrow = { type: MarkerType.ArrowClosed, width: 15, height: 15 };
            const markerEnd = (direction === 'source-to-target' || direction === 'bidirectional') ? arrow : undefined;
            const markerStart = (direction === 'target-to-source' || direction === 'bidirectional') ? arrow : undefined;
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

    const canvasView = transformCanvasView(enabledCanvasFeatures, { nodes, edges });
    const displayNodes = canvasView.nodes;
    const displayEdges = canvasView.edges;

    if (!initialized) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--calm-fg-muted)' }}>Loading CALM architecture...</div>;
    }

    const liveSelectedNode = resolveLiveSelectedNode(selectedNode, nodes, selectedPlace);
    const data = liveSelectedNode ? (liveSelectedNode.data as Record<string, unknown>) : null;

    return (
        <div ref={containerRef} style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--calm-bg)', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: 'var(--calm-fg)' }}>
            {/* Toolbar */}
            <div style={toolbarStyle}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--calm-fg)', marginRight: '12px', flex: '0 0 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>CALM Canvas</span>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={() => handleLayout('DOWN')} className="fid-toolbar-btn" title="Top-to-bottom layout">↓ Layout</button>
                    <button onClick={() => handleLayout('RIGHT')} className="fid-toolbar-btn" title="Left-to-right layout">→ Layout</button>
                    <span className="fid-toolbar-sep" />
                    <CanvasToolbar
                        enabledFeatures={enabledCanvasFeatures}
                        state={{ readonlyMode: store.readonlyMode }}
                        runtime={featureRuntime}
                    />
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

            {/* Banners */}
            {store.readonlyMode && <div style={{ background: 'var(--vscode-editorWarning-foreground, #fbbf24)', color: 'var(--calm-bg)', textAlign: 'center', padding: '4px', fontSize: '11px', fontWeight: 600 }}>Standard Node — Read Only</div>}
            {store.copiesLimited && <div role="status" style={{ background: 'var(--vscode-editorWarning-foreground, #fbbf24)', color: 'var(--calm-bg)', textAlign: 'center', padding: '4px', fontSize: '11px' }}>This diagram is too large to draw a node in each of its containers. Each node is drawn in one container only.</div>}

            {/* Main area */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {!store.readonlyMode && (
                    <NodePalette renderFeatureContent={(paletteSearchQuery) => (
                        <CanvasFeatureSlot
                            slot="palette"
                            definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                            enabledFeatures={enabledCanvasFeatures}
                            runtime={{ ...featureRuntime, paletteSearchQuery }}
                        />
                    )} />
                )}

                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }} onDragOver={handleDragOver} onDrop={handleDrop}>
                    <CanvasFeatureSlot
                        slot="canvas"
                        definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                        enabledFeatures={enabledCanvasFeatures}
                        runtime={featureRuntime}
                    >
                        <ReactFlow
                            nodes={displayNodes} edges={displayEdges} nodeTypes={activeNodeTypes} edgeTypes={edgeTypes}
                            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                            onConnect={onConnect} onNodesDelete={onNodesDelete}
                            onEdgeUpdate={store.readonlyMode ? undefined : handleEdgeReconnect}
                            edgeUpdaterRadius={20}
                            onNodeClick={handleNodeClick} onNodeDoubleClick={handleNodeDoubleClick}
                            onNodeContextMenu={handleNodeContextMenu}
                            onEdgeClick={handleEdgeClick}
                            onEdgeContextMenu={handleEdgeContextMenu}
                            onPaneClick={handlePaneClick} onNodeDragStop={handleNodeDragStop}
                            onDragOver={handleDragOver} onDrop={handleDrop}
                            fitView minZoom={0.1} maxZoom={4} panOnDrag
                            connectionMode={'loose' as any}
                            deleteKeyCode={store.readonlyMode ? null : ['Backspace', 'Delete']}
                            selectionKeyCode="Shift"
                        >
                            <Background />
                            <Controls />
                            <MiniMap nodeClassName={minimapNodeClassName} />
                        </ReactFlow>
                    </CanvasFeatureSlot>

                    {/* Validation Panel */}
                    <CanvasFeatureSlot
                        slot="overlay"
                        definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                        enabledFeatures={enabledCanvasFeatures}
                        runtime={featureRuntime}
                    />
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
                            {selectedEdge && !liveSelectedNode ? (
                                <>
                                <EdgeProperties edge={selectedEdge} readonlyMode={store.readonlyMode} onEdgeUpdate={onEdgeUpdate} />
                                <CanvasFeatureSlot
                                    slot="properties"
                                    definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                                    enabledFeatures={enabledCanvasFeatures}
                                    runtime={featureRuntime}
                                />
                                </>
                            ) : liveSelectedNode && data ? (
                                <>
                                    <div style={{ padding: '12px' }}>
                                        <Field label="ID"><span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 }}>{data.calmId as string ?? liveSelectedNode.id}</span></Field>
                                        <Field label="Name">
                                            <input type="text" defaultValue={String(data.label ?? '')} key={`${liveSelectedNode.id}-name`}
                                                onBlur={(e) => onNodeUpdate(liveSelectedNode.id, 'name', e.target.value)} style={inputStyle} readOnly={store.readonlyMode} />
                                        </Field>
                                        <Field label="Type"><span style={{ fontSize: '12px', color: 'var(--calm-fg)' }}>{data.calmType as string ?? 'system'}</span></Field>
                                        <Field label="Description">
                                            <textarea defaultValue={String(data.description ?? '')} key={`${liveSelectedNode.id}-desc`}
                                                onBlur={(e) => onNodeUpdate(liveSelectedNode.id, 'description', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} readOnly={store.readonlyMode} />
                                        </Field>
                                        {liveSelectedNode.parentId && !store.readonlyMode && (
                                            <button onClick={() => unparentNode(liveSelectedNode.id)} style={unparentBtnStyle}>Remove from Container</button>
                                        )}
                                    </div>
                                    <InterfaceList
                                        interfaces={(data.interfaces as any[]) ?? []}
                                        onUpdate={(ifaces) => onNodeUpdate(liveSelectedNode.id, 'interfaces', ifaces)}
                                        readonly={store.readonlyMode}
                                    />
                                    <CanvasFeatureSlot
                                        slot="properties"
                                        definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                                        enabledFeatures={enabledCanvasFeatures}
                                        runtime={featureRuntime}
                                    />
                                    <CustomMetadata
                                        metadata={(data.metadata as Record<string, string>) ?? {}}
                                        onUpdate={(meta) => onNodeUpdate(liveSelectedNode.id, 'metadata', meta)}
                                        readonly={store.readonlyMode}
                                    />
                                </>
                            ) : (
                                <div style={{ padding: '12px' }}>
                                    <CanvasFeatureSlot
                                        slot="properties"
                                        definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                                        enabledFeatures={enabledCanvasFeatures}
                                        runtime={featureRuntime}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>


            {/* Pattern Picker */}
            <CanvasFeatureSlot
                slot="modal"
                definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                enabledFeatures={enabledCanvasFeatures}
                runtime={featureRuntime}
            />

            <CanvasFeatureSlot
                slot="context-menu"
                definitions={getEnabledFeatureDefinitions(enabledCanvasFeatures)}
                enabledFeatures={enabledCanvasFeatures}
                runtime={featureRuntime}
            />

        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--calm-fg-muted)', marginBottom: '4px' }}>{label}</div>{children}</div>;
}

const toolbarStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '6px 12px', background: 'var(--calm-bg-secondary)', borderBottom: '1px solid var(--calm-border)', flexShrink: 0 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '5px 8px', fontSize: '12px', color: 'var(--calm-fg)', background: 'var(--calm-bg-input)', border: '1px solid var(--calm-border-input)', borderRadius: '3px', outline: 'none', fontFamily: 'inherit' };
const collapsedPanelStyle: React.CSSProperties = { width: '30px', minWidth: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px 0', border: 'none', borderLeft: '1px solid var(--calm-border)', background: 'var(--calm-bg-secondary)', cursor: 'pointer' };
const collapsedLabelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: 'var(--calm-fg-muted)', writingMode: 'vertical-rl', letterSpacing: '1px' };
const collapseToggleStyle: React.CSSProperties = { border: 'none', background: 'transparent', color: 'var(--calm-fg)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px' };
const crumbStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--calm-link)', fontSize: '11px', padding: '2px 4px' };
const unparentBtnStyle: React.CSSProperties = { marginTop: '8px', padding: '4px 10px', fontSize: '11px', color: 'var(--calm-link)', background: 'none', border: '1px solid var(--calm-link)', borderRadius: '4px', cursor: 'pointer' };

export function App() {
    return <ReactFlowProvider><CanvasApp /></ReactFlowProvider>;
}
