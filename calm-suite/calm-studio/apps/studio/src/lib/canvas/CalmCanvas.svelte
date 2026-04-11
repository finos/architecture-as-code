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
		type NodeDragEvent,
		type Viewport,
	} from '@xyflow/svelte';
	import { shortcut } from '@svelte-put/shortcut';
	import { nanoid } from 'nanoid';

	import { nodeTypes, resolveNodeType } from './nodeTypes';
	import { edgeTypes, DEFAULT_EDGE_TYPE } from './edgeTypes';
	import { makeContainment, isContainmentType } from './containment';
	import { resolvePackNode } from '@calmstudio/extensions';
	import EdgeMarkers from './edges/EdgeMarkers.svelte';
	import NodeSearch from '$lib/search/NodeSearch.svelte';
	import { pushSnapshot, undo, redo } from '$lib/stores/history.svelte';
	import { copy, paste } from '$lib/stores/clipboard.svelte';
	import { applyFromCanvas } from '$lib/stores/calmModel.svelte';

	import '@xyflow/svelte/dist/style.css';

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
				data: {
					label: `New ${calmType}`,
					calmId: childId,
					calmType,
				},
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
	} = $props();

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

		const calmType = event.dataTransfer?.getData('application/calm-node-type');
		if (!calmType) return;

		pushSnapshot(nodes, edges);

		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		const id = nanoid();
		const resolvedType = resolveNodeType(calmType);

		const packMeta = calmType.includes(':') ? resolvePackNode(calmType) : null;
		const hasScaffold = resolvedType === 'container' && packMeta?.defaultChildren?.length;

		const newNode: Node = {
			id,
			type: resolvedType,
			position,
			data: {
				label: `New ${calmType}`,
				calmId: id,
				calmType,
			},
		};
		if (resolvedType === 'container') {
			newNode.width = hasScaffold ? 480 : 300;
			newNode.height = hasScaffold ? 280 : 200;
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

		const newNode: Node = {
			id,
			type: resolvedType,
			position,
			data: {
				label: `New ${calmType}`,
				calmId: id,
				calmType,
			},
		};
		if (resolvedType === 'container') {
			newNode.width = hasScaffold ? 480 : 300;
			newNode.height = hasScaffold ? 280 : 200;
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

		// Svelte Flow may auto-add an edge via bind:edges before this callback fires.
		// Check if an edge already exists for this connection.
		const existing = edges.find(
			(e) =>
				(e.source === connection.source && e.target === connection.target) ||
				(e.source === connection.target && e.target === connection.source)
		);

		if (existing) {
			// Edge was auto-added by Svelte Flow — ensure it has our type and data
			edges = edges.map((e) =>
				e.id === existing.id
					? { ...e, type: e.type || DEFAULT_EDGE_TYPE, data: { protocol: '', description: '', ...e.data } }
					: e
			);
		} else {
			// No auto-added edge — create one ourselves
			const newEdge: Edge = {
				id: nanoid(),
				source: connection.source,
				target: connection.target,
				sourceHandle: connection.sourceHandle ?? undefined,
				targetHandle: connection.targetHandle ?? undefined,
				type: DEFAULT_EDGE_TYPE,
				data: {
					protocol: '',
					description: '',
				},
			};
			edges = [...edges, newEdge];
		}

		const edgeType = DEFAULT_EDGE_TYPE;
		if (isContainmentType(edgeType)) {
			nodes = makeContainment(connection.source, connection.target, nodes);
		}
		// Always sync to model so relationships appear in CALM JSON
		applyFromCanvas(nodes, edges);
		notifyChange();
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

	function handleNodeDragStop(event: NodeDragEvent) {
		if (readonly) return;

		const draggedNode = event.node;
		if (!draggedNode) return;
		// Don't reparent nodes that are already parented or are containers
		if (draggedNode.type === 'container' || draggedNode.parentId) return;

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
		onnodedragstop={handleNodeDragStop}
		onedgecontextmenu={handleEdgeContextMenu}
		onselectionchange={handleSelectionChange}
		onnodedblclick={(e) => {
			if (readonly && ondblclicknode) {
				ondblclicknode(e.node);
			}
		}}
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
