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
	import { makeContainment, isContainmentType, ensureContainmentEdge, syncContainmentRelData, applyContainmentVisibility, extractChildFromParent } from './containment';
	import { estimateRectangleNodeSize, ARCHIMATE_ICON_WIDTH } from './rectangleNodeSize';
	import { resolvePackNode, scaffoldNodeMetadata, scaffoldRelationshipMetadata } from '@calmstudio/extensions';
	import EdgeMarkers from './edges/EdgeMarkers.svelte';
	import NodeSearch from '$lib/search/NodeSearch.svelte';
	import { pushSnapshot, undo, redo } from '$lib/stores/history.svelte';
	import { copy, paste } from '$lib/stores/clipboard.svelte';
	import { applyFromCanvas, setSchemaHintForNodeType, getModel } from '$lib/stores/calmModel.svelte';
	import { relativePathBetween } from '$lib/explorer/relativePath';
	import { resolveDefiningHrefFromProject } from '$lib/explorer/definingHref';
	import { isHttpHref } from '$lib/explorer/rewriteDetailedArchitecture';
	import { CALM_NODE_REF_MIME, type CalmNodeRefDragPayload } from '$lib/explorer/types';
	import { getProjectRootHandle } from '$lib/project/projectStore.svelte';
	import { getFileRelativePath } from '$lib/io/fileState.svelte';
	import DuplicateNodeDialog, {
		type DuplicateNodeResult,
	} from './DuplicateNodeDialog.svelte';
	import ContainmentTypeDialog from './ContainmentTypeDialog.svelte';
	import {
		containmentVariantsOnParent,
		getLastUsedContainment,
		setLastUsedContainment,
		type ContainmentVariant,
	} from './containmentLastUsed';
	import {
		CANVAS_NODES_CONTEXT,
		type CanvasNodesGetter,
	} from './edgeRouting/routedEdgePath';
	import { alignBoxes, type AlignMode } from './selectionAlign';
	import { containerSizeForChildren, packChildrenInSquareGrid } from '$lib/layout/containerGrid';
	import {
		canvasPointerInteraction,
		isDiagramShortcutIgnored,
		nodeIdsInRect,
		toggleSelectionIds,
	} from './mousePanSelect';
	import CanvasMinimap from './CanvasMinimap.svelte';

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
				hidden: true,
				data: { protocol: '', description: '', calmVariant: 'composed-of' },
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
		readonlyReason = '',
		ondblclicknode,
		onnavigatereference,
		onfindneighbors,
		onfindusage,
		projectActionsEnabled = false,
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
		readonlyReason?: string;
		/** Called when a node is double-clicked in readonly mode. Used for C4 drill-down navigation. */
		ondblclicknode?: (node: Node) => void;
		/** Called when user double-clicks reference glasses on a node. */
		onnavigatereference?: (calmId: string) => void;
		/** Find project-wide neighbors of this node (R28). */
		onfindneighbors?: (nodeId: string) => void;
		/** Find usages of this node in other files (R37). */
		onfindusage?: (nodeId: string) => void;
		/** True when a project folder is open (enables neighbor/usage menu items). */
		projectActionsEnabled?: boolean;
	} = $props();

	setContext('referenceNavigation', {
		onNavigateReference: (calmId: string) => onnavigatereference?.(calmId),
	});

	setContext('containmentRelSelect', {
		onSelect: (relUniqueId: string) => selectContainmentRelationship(relUniqueId),
	});

	setContext(CANVAS_NODES_CONTEXT, (() => nodes) satisfies CanvasNodesGetter);

	/**
	 * Notify parent of canvas changes. Guards against readonly mode to prevent
	 * isDirty from becoming true during C4 browsing (Pitfall 2).
	 */
	function notifyChange() {
		if (!readonly) oncanvaschange?.();
	}

	const selectedCount = $derived(nodes.filter((n) => n.selected).length);
	const selectedContainer = $derived(
		nodes.find((n) => n.selected && nodes.some((c) => c.parentId === n.id)) ?? null
	);
	let tableCols = $state('');
	let tableRows = $state('');
	let shiftHeld = $state(false);
	let marquee = $state<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
	const flowInteraction = $derived(
		canvasPointerInteraction({
			shiftHeld,
			readonly,
		})
	);

	function handleWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Shift') shiftHeld = true;
		const key = event.key.toLowerCase();
		const mod = event.ctrlKey || event.metaKey;
		if (!mod || isDiagramShortcutIgnored(event.target)) return;
		if (key === 'z' && !event.shiftKey) {
			event.preventDefault();
			handleUndo();
		} else if (key === 'y' || (key === 'z' && event.shiftKey)) {
			event.preventDefault();
			handleRedo();
		}
	}

	function handleWindowKeyup(event: KeyboardEvent) {
		if (event.key === 'Shift') shiftHeld = false;
	}

	function handleWindowBlur() {
		shiftHeld = false;
		marquee = null;
	}

	function handleMarqueeDown(event: PointerEvent) {
		if (readonly || !event.shiftKey || event.button !== 0) return;
		const target = event.target;
		if (!(target instanceof Element)) return;
		if (target.closest('.svelte-flow__node')) return;
		if (!target.closest('.svelte-flow__pane') && !target.closest('.svelte-flow')) return;
		event.preventDefault();
		event.stopPropagation();
		marquee = { x1: event.clientX, y1: event.clientY, x2: event.clientX, y2: event.clientY };
	}

	function handleMarqueeMove(event: PointerEvent) {
		if (!marquee) return;
		marquee = { ...marquee, x2: event.clientX, y2: event.clientY };
	}

	function handleMarqueeUp() {
		if (!marquee) return;
		const box = marquee;
		marquee = null;
		const a = screenToFlowPosition({ x: box.x1, y: box.y1 });
		const b = screenToFlowPosition({ x: box.x2, y: box.y2 });
		const rect = {
			x: Math.min(a.x, b.x),
			y: Math.min(a.y, b.y),
			width: Math.abs(a.x - b.x),
			height: Math.abs(a.y - b.y),
		};
		if (rect.width < 3 && rect.height < 3) return;
		const hits = nodeIdsInRect(nodes, rect);
		const selected = nodes.filter((n) => n.selected).map((n) => n.id);
		const next = toggleSelectionIds(selected, hits);
		nodes = nodes.map((n) => ({ ...n, selected: next.has(n.id) }));
	}

	function applyAlign(mode: AlignMode) {
		if (readonly) return;
		const selected = nodes.filter((n) => n.selected);
		if (selected.length < 2 && mode !== 'table') return;
		pushSnapshot(nodes, edges);
		const boxes = selected.map((n) => ({
			id: n.id,
			x: n.position.x,
			y: n.position.y,
			width: n.width ?? 180,
			height: n.height ?? 70,
		}));
		const next = alignBoxes(boxes, mode);
		const byId = new Map(next.map((b) => [b.id, b]));
		nodes = nodes.map((n) => {
			const box = byId.get(n.id);
			if (!box) return n;
			return {
				...n,
				position: { x: box.x, y: box.y },
				width: box.width,
				height: box.height,
			};
		});
		notifyChange();
	}

	function arrangeSelectedContainer() {
		if (readonly || !selectedContainer) return;
		const childIds = nodes.filter((n) => n.parentId === selectedContainer.id).map((n) => n.id);
		if (childIds.length === 0) return;
		pushSnapshot(nodes, edges);
		const padding = { top: 56, left: 40, bottom: 40, right: 40 };
		const positions = new Map(
			nodes.map((n) => [
				n.id,
				{ x: n.position.x, y: n.position.y, width: n.width, height: n.height },
			])
		);
		const cols = Number.parseInt(tableCols, 10);
		const rows = Number.parseInt(tableRows, 10);
		const packed = packChildrenInSquareGrid(positions, childIds, {
			gap: 40,
			padding,
			cols: Number.isFinite(cols) && cols > 0 ? cols : undefined,
			rows: Number.isFinite(rows) && rows > 0 ? rows : undefined,
		});
		const size = containerSizeForChildren(packed, childIds, padding);
		nodes = nodes.map((n) => {
			if (n.id === selectedContainer.id) {
				return { ...n, width: size.width, height: size.height };
			}
			if (n.parentId !== selectedContainer.id) return n;
			const p = packed.get(n.id);
			if (!p) return n;
			return { ...n, position: { x: p.x, y: p.y } };
		});
		notifyChange();
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
			nodes = nodes.map((n) => ({ ...n, selected: n.id === node.id }));
			edges = edges.map((e) => ({ ...e, selected: false }));
			onselectionchange?.((node.data?.calmId as string) ?? node.id, null);
		}
	}

	/** Select a relationship by unique-id (including hidden containment edges). */
	export function navigateToEdge(relUniqueId: string) {
		selectContainmentRelationship(relUniqueId);
		const edge = edges.find(
			(e) => e.id === relUniqueId || (e.data as { calmRelId?: string } | undefined)?.calmRelId === relUniqueId
		);
		if (!edge) return;
		const src = nodes.find((n) => n.id === edge.source);
		if (src) {
			const x = src.position.x + (src.measured?.width ?? 120) / 2;
			const y = src.position.y + (src.measured?.height ?? 60) / 2;
			setCenter(x, y, { zoom: 1.2, duration: 400 });
		}
	}

	let holdHiddenEdgeSelection = false;

	function selectContainmentRelationship(relUniqueId: string) {
		edges = edges.map((e) => {
			const calmRelId = (e.data as { calmRelId?: string } | undefined)?.calmRelId;
			return {
				...e,
				selected: e.id === relUniqueId || calmRelId === relUniqueId,
			};
		});
		nodes = nodes.map((n) => ({ ...n, selected: false }));
		const edge = edges.find((e) => e.selected);
		holdHiddenEdgeSelection = true;
		onselectionchange?.(null, edge?.id ?? relUniqueId);
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
				await handleNodeRefDrop(ref, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
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

	async function handleNodeRefDrop(
		ref: CalmNodeRefDragPayload,
		position: { x: number; y: number }
	) {
		const id = ref.nodeUniqueId;
		if (nodes.some((n) => n.id === id || n.data?.calmId === id)) {
			return;
		}

		const currentPath = getFileRelativePath();
		const sourceFallback = currentPath
			? relativePathBetween(currentPath, ref.sourceRelativePath)
			: ref.sourceRelativePath;
		let detailedPath = ref.detailedArchitecture?.trim() || '';
		if (!detailedPath) {
			const root = getProjectRootHandle();
			if (root && ref.sourceRelativePath && !isHttpHref(ref.sourceRelativePath)) {
				try {
					detailedPath = await resolveDefiningHrefFromProject({
						root,
						sourcePath: ref.sourceRelativePath,
						nodeUniqueId: id,
						currentFile: currentPath,
					});
				} catch {
					detailedPath = sourceFallback;
				}
			} else {
				detailedPath = sourceFallback;
			}
		}
		if (nodes.some((n) => n.id === id || n.data?.calmId === id)) {
			return;
		}

		pushSnapshot(nodes, edges);

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

		edges = applyContainmentVisibility(
			edges.map((e) =>
				e.id === edgeId
					? { ...e, type: newType, hidden: isContainmentType(newType) }
					: e
			)
		);

		// If changing TO a containment type, establish containment
		if (isContainmentType(newType)) {
			nodes = makeContainment(edge.source, edge.target, nodes);
		}
		nodes = syncContainmentRelData(nodes, edges);
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
		nodeMenu = null;
		edgeMenu = {
			x: event.event.clientX,
			y: event.event.clientY,
			edgeId: event.edge.id,
		};
	}

	let nodeMenu = $state<{ x: number; y: number; nodeId: string } | null>(null);

	function nodeCalmId(node: Node): string {
		return (node.data?.calmId as string) ?? node.id;
	}

	function handleNodeContextMenu(event: { event: MouseEvent; node: Node }) {
		event.event.preventDefault();
		edgeMenu = null;
		const nodeId = nodeCalmId(event.node);
		nodes = nodes.map((n) => ({ ...n, selected: n.id === event.node.id }));
		edges = edges.map((e) => ({ ...e, selected: false }));
		onselectionchange?.(nodeId, null);
		nodeMenu = {
			x: event.event.clientX,
			y: event.event.clientY,
			nodeId,
		};
	}

	function closeNodeMenu() {
		nodeMenu = null;
	}

	function runNodeMenuAction(kind: 'neighbors' | 'usage') {
		if (!nodeMenu) return;
		const id = nodeMenu.nodeId;
		nodeMenu = null;
		if (kind === 'neighbors') onfindneighbors?.(id);
		else onfindusage?.(id);
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

	let dragStartParentId: string | undefined = undefined;
	let dragStartPosition: { x: number; y: number } | undefined = undefined;
	let dragBefore: { nodes: Node[]; edges: Edge[] } | null = null;

	function flowGeometryChanged(
		beforeNodes: Node[],
		beforeEdges: Edge[],
		afterNodes: Node[],
		afterEdges: Edge[]
	): boolean {
		if (beforeNodes.length !== afterNodes.length || beforeEdges.length !== afterEdges.length) return true;
		const byId = new Map(beforeNodes.map((n) => [n.id, n]));
		for (const node of afterNodes) {
			const prev = byId.get(node.id);
			if (!prev) return true;
			if (prev.position.x !== node.position.x || prev.position.y !== node.position.y) return true;
			if (prev.parentId !== node.parentId) return true;
		}
		const edgeKey = (edge: Edge) => `${edge.id}:${edge.source}:${edge.target}:${edge.type ?? ''}`;
		const beforeKeys = beforeEdges.map(edgeKey).sort().join('|');
		const afterKeys = afterEdges.map(edgeKey).sort().join('|');
		return beforeKeys !== afterKeys;
	}

	function commitDragHistory() {
		const before = dragBefore;
		dragBefore = null;
		if (!before) return;
		if (!flowGeometryChanged(before.nodes, before.edges, nodes, edges)) return;
		pushSnapshot(before.nodes, before.edges);
	}
	let altHeldDuringDrag = false;

	let pendingContainment: {
		childId: string;
		parentId: string;
	} | null = $state(null);

	function resolveNestVariant(
		parentId: string,
		currentEdges: Edge[]
	): ContainmentVariant | 'pick' {
		const variants = containmentVariantsOnParent(parentId, currentEdges);
		if (variants.length === 0) return 'pick';
		if (variants.length === 1) return variants[0]!;
		return getLastUsedContainment(parentId) ?? 'pick';
	}

	function applyNest(
		parentId: string,
		childId: string,
		variant: ContainmentVariant,
		currentNodes: Node[],
		currentEdges: Edge[]
	): { nodes: Node[]; edges: Edge[] } {
		setLastUsedContainment(parentId, variant);
		let nextNodes = makeContainment(parentId, childId, currentNodes);
		let nextEdges = ensureContainmentEdge(parentId, childId, currentEdges, variant);
		nextNodes = syncContainmentRelData(nextNodes, nextEdges);
		return { nodes: nextNodes, edges: nextEdges };
	}

	function eventHasAlt(event: MouseEvent | TouchEvent | undefined): boolean {
		if (!event || !('altKey' in event)) return false;
		return event.altKey;
	}

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
			dragBefore = null;
			return;
		}
		dragBefore = {
			nodes: JSON.parse(JSON.stringify(nodes)) as Node[],
			edges: JSON.parse(JSON.stringify(edges)) as Edge[],
		};
		const ev = event as MouseEvent;
		altHeldDuringDrag = ev.altKey;
		dragStartParentId = targetNode.parentId;
		dragStartPosition = { ...targetNode.position };
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
		if (readonly) {
			dragBefore = null;
			return;
		}

		const draggedNode = targetNode;
		if (!draggedNode) return;

		const alt = eventHasAlt(event) || altHeldDuringDrag;
		altHeldDuringDrag = false;
		const originalParentId = dragStartParentId;
		const originalPosition = dragStartPosition;
		dragStartParentId = undefined;
		dragStartPosition = undefined;

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
			dragBefore = null;
			return;
		}
		duplicateDragOrigin = null;

		if (draggedNode.type === 'container') {
			commitDragHistory();
			applyFromCanvas(nodes, edges);
			notifyChange();
			return;
		}

		const dropParentId = findContainmentParent(draggedNode.position, draggedNode.id);

		if (alt) {
			if (dropParentId && dropParentId !== originalParentId) {
				commitDragHistory();
				let nextNodes = nodes;
				let nextEdges = edges;
				if (originalParentId) {
					const extracted = extractChildFromParent(
						originalParentId,
						draggedNode.id,
						nextNodes,
						nextEdges
					);
					nextNodes = extracted.nodes;
					nextEdges = extracted.edges;
				}
				const variant = resolveNestVariant(dropParentId, nextEdges);
				if (variant === 'pick') {
					nodes = nextNodes;
					edges = nextEdges;
					pendingContainment = { childId: draggedNode.id, parentId: dropParentId };
					return;
				}
				const nested = applyNest(dropParentId, draggedNode.id, variant, nextNodes, nextEdges);
				nodes = nested.nodes;
				edges = nested.edges;
				applyFromCanvas(nodes, edges);
				notifyChange();
				return;
			}
			if (originalParentId && dropParentId !== originalParentId) {
				commitDragHistory();
				const extracted = extractChildFromParent(originalParentId, draggedNode.id, nodes, edges);
				nodes = extracted.nodes;
				edges = extracted.edges;
				applyFromCanvas(nodes, edges);
				notifyChange();
				return;
			}
			commitDragHistory();
			applyFromCanvas(nodes, edges);
			notifyChange();
			return;
		}

		// Plain drag: do not create or remove containment. Revert SF auto-parenting.
		if (draggedNode.parentId !== originalParentId) {
			nodes = nodes.map((n) => {
				if (n.id !== draggedNode.id) return n;
				if (originalParentId) {
					return {
						...n,
						parentId: originalParentId,
						extent: 'parent' as const,
						position: originalPosition ?? n.position,
					};
				}
				const { parentId: _p, extent: _e, ...rest } = n;
				return { ...(rest as Node), position: originalPosition ?? n.position };
			});
			edges = edges.filter(
				(e) =>
					!(
						isContainmentType(e.type ?? '') &&
						e.target === draggedNode.id &&
						e.source !== originalParentId
					)
			);
			nodes = syncContainmentRelData(nodes, edges);
		}

		commitDragHistory();
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
			const variant = resolveNestVariant(parentId, nextEdges);
			if (variant === 'pick') {
				nodes = nextNodes;
				edges = nextEdges;
				nodes = syncContainmentRelData(nodes, edges);
				applyFromCanvas(nodes, edges);
				notifyChange();
				onselectionchange?.(newId, null);
				pendingContainment = { childId: newId, parentId };
				return;
			}
			const nested = applyNest(parentId, newId, variant, nextNodes, nextEdges);
			nextNodes = nested.nodes;
			nextEdges = nested.edges;
		}

		nodes = nextNodes;
		edges = nextEdges;
		nodes = syncContainmentRelData(nodes, edges);
		applyFromCanvas(nodes, edges);
		notifyChange();
		onselectionchange?.(newId, null);
	}

	function cancelContainmentPick() {
		pendingContainment = null;
	}

	function confirmContainmentPick(variant: ContainmentVariant) {
		if (!pendingContainment) return;
		const { childId, parentId } = pendingContainment;
		pendingContainment = null;
		pushSnapshot(nodes, edges);
		const nested = applyNest(parentId, childId, variant, nodes, edges);
		nodes = nested.nodes;
		edges = nested.edges;
		applyFromCanvas(nodes, edges);
		notifyChange();
	}

	// ─── Keyboard shortcuts ───────────────────────────────────────────────────

	function handleUndo() {
		if (readonly) return;
		const snapshot = undo({ nodes, edges });
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
		if (readonly || pendingDuplicate) return;
		copy(nodes);
	}

	function handlePaste() {
		if (readonly || pendingDuplicate) return;
		const newNodes = paste(nodes);
		if (newNodes.length > 0) {
			pushSnapshot(nodes, edges);
			nodes = [...nodes, ...newNodes];
			applyFromCanvas(nodes, edges);
		}
	}

	function handleSelectAll() {
		if (pendingDuplicate) return;
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
		if (holdHiddenEdgeSelection && selectedNodes.length === 0 && selectedEdges.length === 0) {
			holdHiddenEdgeSelection = false;
			return;
		}
		holdHiddenEdgeSelection = false;
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

<svelte:window
	onkeydown={handleWindowKeydown}
	onkeyup={handleWindowKeyup}
	onpointerup={handleMarqueeUp}
	onblur={handleWindowBlur}
/>

<!--
  Full-size canvas wrapper. ondragover + ondrop handle palette drops.
  The wrapper div must fill its parent (h-full w-full) so SvelteFlow
  has a proper measurement context.

  Keyboard shortcuts are bound via @svelte-put/shortcut action on the wrapper div.
-->
<div
	class="relative h-full w-full"
	class:canvas-pan={!shiftHeld}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	onpointerdowncapture={handleMarqueeDown}
	onpointermove={handleMarqueeMove}
	onpointerup={handleMarqueeUp}
	role="main"
	aria-label="CALM diagram canvas"
	use:shortcut={{
		trigger: [
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
		nodesDraggable={flowInteraction.nodesDraggable}
		nodesConnectable={!readonly}
		selectionOnDrag={flowInteraction.selectionOnDrag}
		multiSelectionKey="Shift"
		panOnDrag={flowInteraction.panOnDrag}
		fitView
		fitViewOptions={{ maxZoom: 1.2, padding: 0.2 }}
		zoomOnScroll={true}
		panOnScroll={false}
		onconnect={handleConnect}
		onnodedragstart={handleNodeDragStart}
		onnodedrag={(e) => {
			if (e.event && 'altKey' in e.event) altHeldDuringDrag = e.event.altKey;
		}}
		onnodedragstop={handleNodeDragStop}
		ondelete={handleDelete}
		onedgecontextmenu={handleEdgeContextMenu}
		onnodecontextmenu={handleNodeContextMenu}
		onselectionchange={handleSelectionChange}
		onnodeclick={handleNodeClick}
	>
		<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
		<EdgeMarkers />
		<CanvasMinimap />
	</SvelteFlow>

	{#if marquee}
		<div
			class="marquee"
			style="left: {Math.min(marquee.x1, marquee.x2)}px; top: {Math.min(marquee.y1, marquee.y2)}px; width: {Math.abs(marquee.x2 - marquee.x1)}px; height: {Math.abs(marquee.y2 - marquee.y1)}px;"
		></div>
	{/if}

	{#if readonlyReason}
		<div class="readonly-banner" role="status">{readonlyReason}</div>
	{/if}

	{#if !readonly && selectedCount >= 2}
		<div class="align-toolbar" role="toolbar" aria-label="Selection alignment">
			<button type="button" onclick={() => applyAlign('top')}>Top</button>
			<button type="button" onclick={() => applyAlign('bottom')}>Bottom</button>
			<button type="button" onclick={() => applyAlign('center-y')}>Row axis</button>
			<button type="button" onclick={() => applyAlign('left')}>Left</button>
			<button type="button" onclick={() => applyAlign('right')}>Right</button>
			<button type="button" onclick={() => applyAlign('center-x')}>Col axis</button>
			<button type="button" onclick={() => applyAlign('distribute-x')}>Even X</button>
			<button type="button" onclick={() => applyAlign('distribute-y')}>Even Y</button>
			<button type="button" onclick={() => applyAlign('same-width')}>Same W</button>
			<button type="button" onclick={() => applyAlign('same-height')}>Same H</button>
			<button type="button" onclick={() => applyAlign('same-size')}>Same size</button>
			<button type="button" onclick={() => applyAlign('table')}>Table</button>
		</div>
	{/if}

	{#if !readonly && selectedContainer}
		<div class="align-toolbar table-toolbar" role="toolbar" aria-label="Arrange container">
			<input class="table-input" bind:value={tableCols} placeholder="cols" aria-label="Columns" />
			<input class="table-input" bind:value={tableRows} placeholder="rows" aria-label="Rows" />
			<button type="button" onclick={arrangeSelectedContainer}>Arrange to table</button>
		</div>
	{/if}

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

	{#if nodeMenu}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="edge-menu-backdrop" onclick={closeNodeMenu}>
			<div
				class="edge-menu"
				style="left: {nodeMenu.x}px; top: {nodeMenu.y}px;"
				onclick={(e) => e.stopPropagation()}
			>
				<div class="edge-menu-header">Node</div>
				<button
					type="button"
					class="edge-menu-item"
					disabled={!projectActionsEnabled || !onfindneighbors}
					title={projectActionsEnabled ? 'Find neighbors' : 'Open a project folder first'}
					onclick={() => runNodeMenuAction('neighbors')}
				>
					Find neighbors…
				</button>
				<button
					type="button"
					class="edge-menu-item"
					disabled={!projectActionsEnabled || !onfindusage}
					title={projectActionsEnabled ? 'Find usage' : 'Open a project folder first'}
					onclick={() => runNodeMenuAction('usage')}
				>
					Find usage…
				</button>
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

{#if pendingContainment}
	<ContainmentTypeDialog
		childLabel={String(nodes.find((n) => n.id === pendingContainment?.childId)?.data?.label ?? pendingContainment.childId)}
		parentLabel={String(nodes.find((n) => n.id === pendingContainment?.parentId)?.data?.label ?? pendingContainment.parentId)}
		onconfirm={confirmContainmentPick}
		oncancel={cancelContainmentPick}
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

	.edge-menu-item:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.canvas-pan :global(.svelte-flow__pane) {
		cursor: grab;
	}

	.canvas-pan:active :global(.svelte-flow__pane) {
		cursor: grabbing;
	}

	.marquee {
		position: fixed;
		z-index: 30;
		pointer-events: none;
		border: 1px solid var(--color-accent, #3b82f6);
		background: color-mix(in srgb, var(--color-accent, #3b82f6) 18%, transparent);
	}

	.readonly-banner {
		position: absolute;
		top: 8px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		padding: 6px 12px;
		border-radius: 6px;
		background: #334155;
		color: #fff;
		font-size: 12px;
	}

	.align-toolbar {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		max-width: 90%;
		padding: 6px;
		border-radius: 8px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
	}

	.table-toolbar {
		bottom: 52px;
	}

	:global(.svelte-flow__minimap.canvas-minimap) {
		z-index: 8;
		margin: 8px;
		overflow: hidden;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 8px;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
	}

	.align-toolbar button,
	.table-input {
		height: 26px;
		padding: 0 8px;
		font-size: 11px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 4px;
		background: #fff;
		cursor: pointer;
	}

	.table-input {
		width: 52px;
		cursor: text;
	}

	:global(.dark) .edge-menu-item {
		color: #e2e8f0;
	}

	:global(.dark) .edge-menu-item:hover {
		background: #1e293b;
	}

</style>
