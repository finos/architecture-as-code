<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  CalmCanvas.svelte — Main Svelte Flow canvas wrapper for CALM Studio.

  Responsibilities:
  - Mounts <SvelteFlow> with all CALM nodeTypes and edgeTypes
  - Handles HTML5 drag-and-drop from NodePalette (ondragover + ondrop)
  - Creates new nodes via screenToFlowPosition when items are dropped
  - Handles click-to-place via the onplacenode callback prop
  - Creates edges defaulting to DEFAULT_EDGE_TYPE ('connects')
  - Creates containment when deployed-in/composed-of edges are drawn
  - Detects node drag-into-container and auto-creates containment
  - Renders EdgeMarkers.svelte once (shared SVG defs for all edges)
  - Wires undo/redo (Cmd+Z/Cmd+Shift+Z), copy/paste (Cmd+C/V)
  - Wires search panel (Cmd+F), dark mode keyboard shortcut
  - Calls pushSnapshot BEFORE every mutation (RESEARCH Pitfall 6)

  Key decisions:
  - MUST use $state.raw for nodes/edges — Svelte Flow mutates arrays internally;
    deep $state() reactivity causes double-render loops (RESEARCH Pitfall 1)
  - makeContainment is called for both edge-draw and node drag-into (per user decision)
  - @svelte-put/shortcut action used for declarative keyboard shortcut binding
-->
<script lang="ts">
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		useSvelteFlow,
		type Node,
		type Edge,
		type Connection,
		type Viewport,
	} from '@xyflow/svelte';
	import { tick } from 'svelte';
	import { shortcut } from '@svelte-put/shortcut';
	import { nanoid } from 'nanoid';
	import { setContext } from 'svelte';

	import { nodeTypes, resolveNodeType } from './nodeTypes';
	import { edgeTypes, DEFAULT_EDGE_TYPE } from './edgeTypes';
import { makeContainment, isContainmentType, ensureContainmentEdge } from './containment';
	import { estimateRectangleNodeSize, ARCHIMATE_ICON_WIDTH } from './rectangleNodeSize';
	import { resolvePackNode, scaffoldNodeMetadata, scaffoldRelationshipMetadata } from '@calmstudio/extensions';
	import EdgeMarkers from './edges/EdgeMarkers.svelte';
	import NodeSearch from '$lib/search/NodeSearch.svelte';
	import { pushSnapshot, undo, redo } from '$lib/stores/history.svelte';
	import { copy, paste } from '$lib/stores/clipboard.svelte';
	import { applyFromCanvas, setSchemaHintForNodeType, getModel } from '$lib/stores/calmModel.svelte';
	import { relativePathBetween } from '$lib/explorer/relativePath';
	import { CALM_NODE_REF_MIME, type CalmNodeRefDragPayload } from '$lib/explorer/types';
	import { getFileRelativePath } from '$lib/io/fileState.svelte';
	import DuplicateNodeDialog, {
		type DuplicateNodeResult,
	} from './DuplicateNodeDialog.svelte';
	import {
		CANVAS_NODES_CONTEXT,
		type CanvasNodesGetter,
	} from './edgeRouting/routedEdgePath';

	import '@xyflow/svelte/dist/style.css';

	function applyRectangleLayoutSize(node: Node, label: string, isReference = false): void {
		const resolvedType = node.type ?? resolveNodeType(node.data?.calmType as string);
		const packMeta =
			typeof node.data?.calmType === 'string' && node.data.calmType.includes(':')
				? resolvePackNode(node.data.calmType)
				: null;
		const isRectangle =
			resolvedType === 'service' ||
			resolvedType === 'system' ||
			(resolvedType === 'extension' && packMeta?.rectangleLayout === true);
		if (!isRectangle) return;
		const calmType = node.data?.calmType as string | undefined;
		const iconWidth = calmType?.startsWith('archimate:') ? ARCHIMATE_ICON_WIDTH : undefined;
		const size = estimateRectangleNodeSize(label, {
			hasReference: isReference,
			hasClassification: !!node.data?.['data-classification'],
			iconWidth,
		});
		node.width = size.width;
		node.height = size.height;
	}

	// ─── Node data helper (metadata scaffold R17) ─────────────────────────────

	function buildNodeData(
		calmType: string,
		id: string,
		label: string,
		description: string,
		extra: Record<string, unknown> = {},
	): Record<string, unknown> {
		const data: Record<string, unknown> = {
			label,
			calmId: id,
			calmType,
			description,
			...extra,
		};
		const metadata = scaffoldNodeMetadata(calmType);
		if (metadata) {
			data.metadata = metadata;
		}
		return data;
	}

	function edgeDataWithScaffold(sourceId: string, targetId: string): Record<string, unknown> {
		const sourceType = String(nodes.find((n) => n.id === sourceId)?.data?.calmType ?? '');
		const targetType = String(nodes.find((n) => n.id === targetId)?.data?.calmType ?? '');
		const base: Record<string, unknown> = { protocol: '', description: '' };
		const metadata = scaffoldRelationshipMetadata(sourceType, targetType);
		if (metadata) {
			base.metadata = metadata;
		}
		return base;
	}

	// ─── Container scaffold helper ──────────────────────────────────────────
	// When a container with defaultChildren is placed, auto-create child nodes
	// inside it with composed-of edges in a 2-column grid layout.

	function scaffoldChildren(
		parentNode: Node,
		childTypes: string[],
	): { childNodes: Node[]; childEdges: Edge[] } {
		const cols = 2;
		const padX = 30;
		const padY = 50;
		const cellW = 200;
		const cellH = 80;
		const gapX = 20;
		const gapY = 20;

		const childNodes: Node[] = [];
		const childEdges: Edge[] = [];

		for (let i = 0; i < childTypes.length; i++) {
			const calmType = childTypes[i];
			const col = i % cols;
			const row = Math.floor(i / cols);
			const childId = nanoid();
			const childResolvedType = resolveNodeType(calmType);

			childNodes.push({
				id: childId,
				type: childResolvedType,
				position: {
					x: padX + col * (cellW + gapX),
					y: padY + row * (cellH + gapY),
				},
				parentId: parentNode.id,
				extent: 'parent',
				data: buildNodeData(calmType, childId, `New ${calmType}`, `New ${calmType}`),
			});

			childEdges.push({
				id: nanoid(),
				source: parentNode.id,
				target: childId,
				type: 'composed-of',
				data: { protocol: '', description: '' },
			});
		}

		return { childNodes, childEdges };
	}

	// ─── Props ────────────────────────────────────────────────────────────────

	let {
		nodes = $bindable<Node[]>([]),
		edges = $bindable<Edge[]>([]),
		onplacenode,
		onselectionchange,
		onfileimport,
		oncanvaschange,
		readonly = false,
		ondblclicknode,
		onnavigatereference,
	}: {
		nodes?: Node[];
		edges?: Edge[];
		/** Called by parent when a palette item is clicked — places node at viewport center. */
		onplacenode?: (type: string) => void;
		/** Called when canvas selection changes. nodeId and edgeId are the IDs of the first selected items (or null). */
		onselectionchange?: (nodeId: string | null, edgeId: string | null) => void;
		/** Called when a .json file is dropped onto the canvas. Receives file content and filename. */
		onfileimport?: (content: string, filename: string) => void;
		/** Called when canvas content changes (node drag, edge create, delete, etc.) for dirty tracking. */
		oncanvaschange?: () => void;
		/** When true, disables dragging, connecting, delete keys, and all mutation handlers. Used for C4 navigation mode. */
		readonly?: boolean;
		/** Called when a node is double-clicked in readonly mode. Used for C4 drill-down navigation. */
		ondblclicknode?: (node: Node) => void;
		/** Called when user double-clicks reference glasses on a node. */
		onnavigatereference?: (calmId: string) => void;
	} = $props();

	setContext('referenceNavigation', {
		onNavigateReference: (calmId: string) => onnavigatereference?.(calmId),
	});

	setContext(CANVAS_NODES_CONTEXT, (() => nodes) satisfies CanvasNodesGetter);

	/**
	 * Notify parent of canvas changes. Guards against readonly mode to prevent
	 * isDirty from becoming true during C4 browsing (Pitfall 2).
	 */
	function notifyChange() {
		if (!readonly) oncanvaschange?.();
	}

	// ─── Svelte Flow context ─────────────────────────────────────────────────

	const { screenToFlowPosition, fitView, setCenter, getViewport, setViewport } = useSvelteFlow();

	/**
	 * Fit all nodes into view. Called by parent after import or layout.
	 */
	export function fitViewport() {
		fitView({ duration: 300, maxZoom: 1.2, padding: 0.2 });
	}

	/**
	 * Save the current viewport state (position + zoom).
	 * Called by parent before entering C4 mode so it can be restored on exit.
	 */
	export function saveViewport(): Viewport {
		return getViewport();
	}

	/**
	 * Restore a previously saved viewport state with animation.
	 * Called by parent after exiting C4 mode.
	 */
	export function restoreViewport(vp: Viewport): void {
		setViewport(vp, { duration: 300 });
	}

	/**
	 * Center the viewport on the node or edge identified by calmId.
	 * Called by parent (+page.svelte) in response to ValidationPanel row clicks.
	 */
	export function navigateToNode(calmId: string) {
		const node = nodes.find((n) => (n.data?.calmId as string) === calmId || n.id === calmId);
		if (node) {
			const x = node.position.x + (node.measured?.width ?? 120) / 2;
			const y = node.position.y + (node.measured?.height ?? 60) / 2;
			setCenter(x, y, { zoom: 1.2, duration: 400 });
			// Select the node
			nodes = nodes.map((n) => ({ ...n, selected: n.id === node.id }));
		}
	}

	// ─── Search state ─────────────────────────────────────────────────────────

	let searchOpen = $state(false);

	function handleSearchResults(ids: string[]) {
		if (ids.length === 0) return;
		// Highlight matching nodes by setting selected: true
		nodes = nodes.map((n) => ({
			...n,
			selected: ids.includes(n.id),
		}));
	}

	function closeSearch() {
		searchOpen = false;
		// Deselect all nodes when search closes
		nodes = nodes.map((n) => ({ ...n, selected: false }));
	}

	// ─── DnD drop handler ────────────────────────────────────────────────────

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'copy';
		}
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();

		// In readonly mode, only allow file imports — no new node drops
		if (readonly) return;

		// Check for file drop first (JSON file import)
		const file = event.dataTransfer?.files[0];
		if (file && (file.name.endsWith('.json') || file.name.endsWith('.calm.json'))) {
			const content = await file.text();
			onfileimport?.(content, file.name);
			return;
		}

		const refRaw = event.dataTransfer?.getData(CALM_NODE_REF_MIME);
		if (refRaw) {
			try {
				const ref = JSON.parse(refRaw) as CalmNodeRefDragPayload;
				handleNodeRefDrop(ref, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
			} catch {
				// ignore malformed payload
			}
			return;
		}

		const calmType = event.dataTransfer?.getData('application/calm-node-type');
		if (!calmType) return;

		pushSnapshot(nodes, edges);

		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		const id = nanoid();
		const resolvedType = resolveNodeType(calmType);
		const isFirstNode = getModel().nodes.length === 0;
		if (isFirstNode) {
			setSchemaHintForNodeType(calmType);
		}
		const packMeta = calmType.includes(':') ? resolvePackNode(calmType) : null;
		const defaultDescription = packMeta?.label ?? `New ${calmType}`;
		const hasScaffold = resolvedType === 'container' && packMeta?.defaultChildren?.length;

		const newNode: Node = {
			id,
			type: resolvedType,
			position,
			data: buildNodeData(calmType, id, defaultDescription, defaultDescription),
		};
		if (resolvedType === 'container') {
			newNode.width = hasScaffold ? 480 : 300;
			newNode.height = hasScaffold ? 280 : 200;
		} else {
			applyRectangleLayoutSize(newNode, defaultDescription);
		}

		if (hasScaffold) {
			const { childNodes, childEdges } = scaffoldChildren(newNode, packMeta.defaultChildren!);
			nodes = [...nodes, newNode, ...childNodes];
			edges = [...edges, ...childEdges];
		} else {
			nodes = [...nodes, newNode];
		}
		applyFromCanvas(nodes, edges);
		notifyChange();
	}

	function handleNodeRefDrop(
		ref: CalmNodeRefDragPayload,
		position: { x: number; y: number }
	) {
		const id = ref.nodeUniqueId;
		if (nodes.some((n) => n.id === id || n.data?.calmId === id)) {
			return;
		}

		pushSnapshot(nodes, edges);

		const currentPath = getFileRelativePath();
		const detailedPath = currentPath
			? relativePathBetween(currentPath, ref.sourceRelativePath)
			: ref.sourceRelativePath;

		const resolvedType = resolveNodeType(ref.nodeType);
		const newNode: Node = {
			id,
			type: resolvedType,
			position,
			class: 'reference-node',
			data: {
				label: ref.name,
				calmId: id,
				calmType: ref.nodeType,
				description: ref.description || 'External architecture reference',
				isReference: true,
				calmDetails: { 'detailed-architecture': detailedPath },
			},
		};

		applyRectangleLayoutSize(newNode, ref.name, true);

		nodes = [...nodes, newNode];
		applyFromCanvas(nodes, edges);
		notifyChange();
	}

	// ─── Click-to-place ──────────────────────────────────────────────────────

	/**
	 * Place a node at the viewport center.
	 * Called by parent (+page.svelte) in response to NodePalette's placenode event.
	 */
	export function placeNodeAtCenter(calmType: string) {
		const position = screenToFlowPosition({
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		});
		const id = nanoid();
		const resolvedType = resolveNodeType(calmType);

		pushSnapshot(nodes, edges);

		const packMeta = calmType.includes(':') ? resolvePackNode(calmType) : null;
		const hasScaffold = resolvedType === 'container' && packMeta?.defaultChildren?.length;

		const displayLabel = packMeta?.label ?? `New ${calmType}`;

		const newNode: Node = {
			id,
			type: resolvedType,
			position,
			data: buildNodeData(calmType, id, displayLabel, displayLabel),
		};
		if (resolvedType === 'container') {
			newNode.width = hasScaffold ? 480 : 300;
			newNode.height = hasScaffold ? 280 : 200;
		} else {
			applyRectangleLayoutSize(newNode, displayLabel);
		}

		if (hasScaffold) {
			const { childNodes, childEdges } = scaffoldChildren(newNode, packMeta.defaultChildren!);
			nodes = [...nodes, newNode, ...childNodes];
			edges = [...edges, ...childEdges];
		} else {
			nodes = [...nodes, newNode];
		}
		applyFromCanvas(nodes, edges);
		notifyChange();
	}

	// ─── Edge creation ───────────────────────────────────────────────────────

	function handleConnect(connection: Connection) {
		if (readonly) return;

		pushSnapshot(nodes, edges);

		const applyConnection = () => {
			// Svelte Flow may auto-add an edge via bind:edges before this callback fires.
			const existing = edges.find(
				(e) =>
					(e.source === connection.source && e.target === connection.target) ||
					(e.source === connection.target && e.target === connection.source)
			);

			if (existing) {
				edges = edges.map((e) =>
					e.id === existing.id
						? {
								...e,
								type: e.type || DEFAULT_EDGE_TYPE,
								data: {
									...edgeDataWithScaffold(connection.source, connection.target),
									...e.data,
									calmVariant: DEFAULT_EDGE_TYPE,
								},
							}
						: e
				);
			} else {
				const newEdge: Edge = {
					id: nanoid(),
					source: connection.source,
					target: connection.target,
					sourceHandle: connection.sourceHandle ?? undefined,
					targetHandle: connection.targetHandle ?? undefined,
					type: DEFAULT_EDGE_TYPE,
					data: {
						...edgeDataWithScaffold(connection.source, connection.target),
						calmVariant: DEFAULT_EDGE_TYPE,
					},
				};
				edges = [...edges, newEdge];
			}

			if (isContainmentType(DEFAULT_EDGE_TYPE)) {
				nodes = makeContainment(connection.source, connection.target, nodes);
			}
			applyFromCanvas(nodes, edges);
			notifyChange();
		};

		void tick().then(applyConnection);
	}

	/**
	 * Change the type of an existing edge (e.g. connects -> deployed-in).
	 * Handles containment side-effects when switching to/from containment types.
	 */
	function changeEdgeType(edgeId: string, newType: string) {
		pushSnapshot(nodes, edges);

		const edge = edges.find((e) => e.id === edgeId);
		if (!edge) return;

		edges = edges.map((e) =>
			e.id === edgeId ? { ...e, type: newType } : e
		);

		// If changing TO a containment type, establish containment
		if (isContainmentType(newType)) {
			nodes = makeContainment(edge.source, edge.target, nodes);
		}
		applyFromCanvas(nodes, edges);
		notifyChange();
	}

	// ─── Edge context menu (right-click to change type) ─────────────────────

	let edgeMenu = $state<{ x: number; y: number; edgeId: string } | null>(null);

	const EDGE_TYPE_OPTIONS = [
		{ value: 'connects', label: 'Connects' },
		{ value: 'interacts', label: 'Interacts' },
		{ value: 'deployed-in', label: 'Deployed In' },
		{ value: 'composed-of', label: 'Composed Of' },
		{ value: 'options', label: 'Options' },
	];

	function handleEdgeContextMenu(event: { event: MouseEvent; edge: Edge }) {
		if (readonly) return;
		event.event.preventDefault();
		edgeMenu = {
			x: event.event.clientX,
			y: event.event.clientY,
			edgeId: event.edge.id,
		};
	}

	function selectEdgeType(type: string) {
		if (edgeMenu) {
			changeEdgeType(edgeMenu.edgeId, type);
			edgeMenu = null;
		}
	}

	function closeEdgeMenu() {
		edgeMenu = null;
	}

	// ─── Node drag-into-container ────────────────────────────────────────────

	/**
	 * Checks whether point a is inside the bounding box of b.
	 */
	function isInsideBounds(
		a: { x: number; y: number },
		b: { x: number; y: number; width?: number; height?: number }
	): boolean {
		const bw = b.width ?? 200;
		const bh = b.height ?? 150;
		return (
			a.x >= b.x &&
			a.x <= b.x + bw &&
			a.y >= b.y &&
			a.y <= b.y + bh
		);
	}

	let lastNodeClick: { id: string; time: number } | null = null;

	/** R21 — Ctrl/Cmd+drag duplicate state */
	let duplicateDragOrigin: {
		nodeId: string;
		position: { x: number; y: number };
		parentId?: string;
	} | null = null;
	let pendingDuplicate: {
		source: Node;
		dropPosition: { x: number; y: number };
	} | null = $state(null);

	function handleNodeClick({ node }: { node: Node; event: MouseEvent | TouchEvent }) {
		if (!readonly || !ondblclicknode) return;
		const now = Date.now();
		if (lastNodeClick?.id === node.id && now - lastNodeClick.time < 400) {
			ondblclicknode(node);
			lastNodeClick = null;
		} else {
			lastNodeClick = { id: node.id, time: now };
		}
	}

	function handleNodeDragStart({
		targetNode,
		event,
	}: {
		targetNode: Node | null;
		nodes: Node[];
		event: MouseEvent | TouchEvent;
	}) {
		if (readonly || !targetNode) {
			duplicateDragOrigin = null;
			return;
		}
		const ev = event as MouseEvent;
		if (ev.ctrlKey || ev.metaKey) {
			duplicateDragOrigin = {
				nodeId: targetNode.id,
				position: { ...targetNode.position },
				parentId: targetNode.parentId,
			};
			document.body.style.cursor = 'copy';
		} else {
			duplicateDragOrigin = null;
		}
	}

	function findContainmentParent(
		dropPos: { x: number; y: number },
		excludeId: string
	): string | null {
		for (const candidate of nodes) {
			if (candidate.id === excludeId) continue;
			if (
				candidate.type === 'container' ||
				(candidate.measured?.width && candidate.measured.width > 100)
			) {
				const bounds = {
					x: candidate.position.x,
					y: candidate.position.y,
					width: candidate.measured?.width ?? candidate.width ?? 200,
					height: candidate.measured?.height ?? candidate.height ?? 150,
				};
				if (isInsideBounds(dropPos, bounds)) {
					return candidate.id;
				}
			}
		}
		return null;
	}

	function handleNodeDragStop({
		targetNode,
		event,
	}: {
		targetNode: Node | null;
		nodes: Node[];
		event: MouseEvent | TouchEvent;
	}) {
		document.body.style.cursor = '';
		if (readonly) return;

		const draggedNode = targetNode;
		if (!draggedNode) return;

		// R21 — Ctrl/Cmd+drag → restore original, open duplicate modal
		if (duplicateDragOrigin && duplicateDragOrigin.nodeId === draggedNode.id) {
			const origin = duplicateDragOrigin;
			const dropPosition = { ...draggedNode.position };
			const sourceSnapshot = JSON.parse(
				JSON.stringify(nodes.find((n) => n.id === origin.nodeId) ?? draggedNode)
			) as Node;
			// Restore original node to pre-drag position
			nodes = nodes.map((n) =>
				n.id === origin.nodeId
					? {
							...n,
							position: origin.position,
							parentId: origin.parentId,
							selected: false,
						}
					: n
			);
			duplicateDragOrigin = null;
			sourceSnapshot.position = origin.position;
			sourceSnapshot.parentId = origin.parentId;
			pendingDuplicate = { source: sourceSnapshot, dropPosition };
			return;
		}
		duplicateDragOrigin = null;

		// Svelte Flow may set parentId during drag without creating a CALM edge.
		// Ensure a composed-of edge exists and sync the canonical model.
		if (draggedNode.parentId && draggedNode.type !== 'container') {
			edges = ensureContainmentEdge(draggedNode.parentId, draggedNode.id, edges);
			applyFromCanvas(nodes, edges);
			notifyChange();
			return;
		}

		if (draggedNode.type === 'container') {
			applyFromCanvas(nodes, edges);
			notifyChange();
			return;
		}

		// Find any large node whose bounds contain the dragged node's position.
		// Any node type can become a container when something is dropped into it.
		for (const candidate of nodes) {
			if (candidate.id === draggedNode.id) continue;
			if (candidate.type === 'container' || (candidate.measured?.width && candidate.measured.width > 100)) {
				const bounds = {
					x: candidate.position.x,
					y: candidate.position.y,
					width: candidate.measured?.width ?? candidate.width ?? 200,
					height: candidate.measured?.height ?? candidate.height ?? 150,
				};
				if (isInsideBounds(draggedNode.position, bounds)) {
					pushSnapshot(nodes, edges);
					nodes = makeContainment(candidate.id, draggedNode.id, nodes);
					edges = ensureContainmentEdge(candidate.id, draggedNode.id, edges);
					applyFromCanvas(nodes, edges);
					notifyChange();
					return;
				}
			}
		}
		// Regular drag stop (position change only)
		applyFromCanvas(nodes, edges);
		notifyChange();
	}

	function cancelDuplicate() {
		pendingDuplicate = null;
	}

	function confirmDuplicate(result: DuplicateNodeResult) {
		if (!pendingDuplicate) return;
		const { source, dropPosition } = pendingDuplicate;
		pendingDuplicate = null;

		const oldId = (source.data?.calmId as string) ?? source.id;
		const newId = nanoid();
		pushSnapshot(nodes, edges);

		const clone: Node = {
			...JSON.parse(JSON.stringify(source)),
			id: newId,
			position: { ...dropPosition },
			selected: true,
			parentId: undefined,
			data: {
				...JSON.parse(JSON.stringify(source.data ?? {})),
				calmId: newId,
				label: result.name,
			},
		};
		applyRectangleLayoutSize(clone, result.name, !!(source.data as Record<string, unknown>)?.isReference);

		let nextNodes: Node[] = nodes.map((n) => ({ ...n, selected: false }));
		nextNodes = [...nextNodes, clone];
		let nextEdges: Edge[] = edges;

		if (result.duplicateRelationships) {
			const clonedEdges = edges
				.filter((e) => e.source === oldId || e.target === oldId || e.source === source.id || e.target === source.id)
				.map((e) => {
					const edgeClone = JSON.parse(JSON.stringify(e)) as Edge;
					edgeClone.id = nanoid();
					edgeClone.selected = false;
					if (edgeClone.source === oldId || edgeClone.source === source.id) edgeClone.source = newId;
					if (edgeClone.target === oldId || edgeClone.target === source.id) edgeClone.target = newId;
					if (edgeClone.data) {
						edgeClone.data = {
							...edgeClone.data,
							calmRelId: nanoid(),
						};
					}
					return edgeClone;
				});
			nextEdges = [...edges, ...clonedEdges];
		}

		const parentId = findContainmentParent(dropPosition, newId);
		if (parentId) {
			nextNodes = makeContainment(parentId, newId, nextNodes);
			nextEdges = ensureContainmentEdge(parentId, newId, nextEdges);
		}

		nodes = nextNodes;
		edges = nextEdges;
		applyFromCanvas(nodes, edges);
		notifyChange();
		onselectionchange?.(newId, null);
	}

	// ─── Keyboard shortcuts ───────────────────────────────────────────────────

	function handleUndo() {
		if (readonly) return;
		const snapshot = undo();
		if (snapshot) {
			nodes = snapshot.nodes;
			edges = snapshot.edges;
			applyFromCanvas(nodes, edges);
		}
	}

	function handleRedo() {
		if (readonly) return;
		const snapshot = redo();
		if (snapshot) {
			nodes = snapshot.nodes;
			edges = snapshot.edges;
			applyFromCanvas(nodes, edges);
		}
	}

	function handleCopy() {
		if (readonly) return;
		copy(nodes);
	}

	function handlePaste() {
		if (readonly) return;
		const newNodes = paste(nodes);
		if (newNodes.length > 0) {
			pushSnapshot(nodes, edges);
			nodes = [...nodes, ...newNodes];
			applyFromCanvas(nodes, edges);
		}
	}

	function handleSelectAll() {
		nodes = nodes.map((n) => ({ ...n, selected: true }));
	}

	function handleToggleSearch() {
		searchOpen = !searchOpen;
		if (!searchOpen) {
			// Clear search highlights when closing
			nodes = nodes.map((n) => ({ ...n, selected: false }));
		}
	}

	// ─── Selection change ─────────────────────────────────────────────────────

	function handleSelectionChange({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) {
		const nodeId = selectedNodes.length > 0 ? (selectedNodes[0].data?.calmId as string ?? selectedNodes[0].id) : null;
		const edgeId = selectedEdges.length > 0 ? selectedEdges[0].id : null;
		onselectionchange?.(nodeId, edgeId);
	}

	function handleDelete({
		nodes: deletedNodes,
		edges: deletedEdges,
	}: {
		nodes: Node[];
		edges: Edge[];
	}) {
		if (readonly) return;
		if (deletedNodes.length === 0 && deletedEdges.length === 0) return;
		pushSnapshot(nodes, edges);
		applyFromCanvas(nodes, edges);
		notifyChange();
	}
</script>

<!--
  Full-size canvas wrapper. ondragover + ondrop handle palette drops.
  The wrapper div must fill its parent (h-full w-full) so SvelteFlow
  has a proper measurement context.

  Keyboard shortcuts are bound via @svelte-put/shortcut action on the wrapper div.
-->
<div
	class="relative h-full w-full"
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="main"
	aria-label="CALM diagram canvas"
	use:shortcut={{
		trigger: [
			{ key: 'z', modifier: ['meta'], callback: handleUndo },
			{ key: 'z', modifier: ['meta', 'shift'], callback: handleRedo },
			{ key: 'c', modifier: ['meta'], callback: handleCopy },
			{ key: 'v', modifier: ['meta'], callback: handlePaste },
			{ key: 'a', modifier: ['meta'], callback: handleSelectAll },
			{ key: 'f', modifier: ['meta'], callback: handleToggleSearch },
		],
	}}
>
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{edgeTypes}
		deleteKey={readonly ? [] : ['Delete', 'Backspace']}
		nodesDraggable={!readonly}
		nodesConnectable={!readonly}
		selectionKey="Shift"
		multiSelectionKey="Meta"
		fitView
		fitViewOptions={{ maxZoom: 1.2, padding: 0.2 }}
		zoomOnScroll={true}
		panOnDrag={true}
		panOnScroll={false}
		onconnect={handleConnect}
		onnodedragstart={handleNodeDragStart}
		onnodedragstop={handleNodeDragStop}
		ondelete={handleDelete}
		onedgecontextmenu={handleEdgeContextMenu}
		onselectionchange={handleSelectionChange}
		onnodeclick={handleNodeClick}
	>
		<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
		<EdgeMarkers />
	</SvelteFlow>

	<!-- Floating search panel — shown when Cmd+F is pressed -->
	{#if searchOpen}
		<NodeSearch
			{nodes}
			onresults={handleSearchResults}
			onclose={closeSearch}
		/>
	{/if}

	<!-- Edge type context menu — right-click an edge to change its type -->
	{#if edgeMenu}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="edge-menu-backdrop" onclick={closeEdgeMenu}>
			<div
				class="edge-menu"
				style="left: {edgeMenu.x}px; top: {edgeMenu.y}px;"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="edge-menu-header">Edge Type</div>
				{#each EDGE_TYPE_OPTIONS as opt}
					<button
						type="button"
						class="edge-menu-item"
						onclick={() => selectEdgeType(opt.value)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

{#if pendingDuplicate}
	<DuplicateNodeDialog
		defaultName={`${(pendingDuplicate.source.data?.label as string) || 'Node'} (copy)`}
		onconfirm={confirmDuplicate}
		oncancel={cancelDuplicate}
	/>
{/if}

<style>
	.edge-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
	}

	.edge-menu {
		position: fixed;
		z-index: 101;
		min-width: 140px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
		padding: 4px;
		font-family: var(--font-sans);
	}

	:global(.dark) .edge-menu {
		background: #111827;
		border-color: #334155;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.edge-menu-header {
		padding: 4px 8px;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-tertiary);
	}

	.edge-menu-item {
		display: block;
		width: 100%;
		padding: 6px 8px;
		border: none;
		background: none;
		border-radius: 5px;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-primary);
		text-align: left;
		cursor: pointer;
		transition: background 0.1s;
	}

	.edge-menu-item:hover {
		background: var(--color-surface-tertiary);
	}

	:global(.dark) .edge-menu-item {
		color: #e2e8f0;
	}

	:global(.dark) .edge-menu-item:hover {
		background: #1e293b;
	}

</style>
