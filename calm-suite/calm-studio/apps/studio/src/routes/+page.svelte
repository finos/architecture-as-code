<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import { initAllPacks } from '@calmstudio/extensions';
	import { type Node, type Edge, SvelteFlowProvider, type Viewport } from '@xyflow/svelte';
	import { tick, onMount } from 'svelte';
	import { PaneGroup, Pane, PaneResizer } from 'paneforge';

	// Register all extension packs at module load time — before any component renders.
	// This must be module-level (not inside onMount) so packs are available before
	// the first paint, per RESEARCH Pattern 7: register at module load, not lazy.
	initAllPacks();
	import { initAllTemplates, loadTemplate } from '$lib/templates/registry';
	import TemplatePicker from '$lib/templates/TemplatePicker.svelte';

	// Register all templates at module load time alongside packs.
	initAllTemplates();
	import DnDProvider from '$lib/palette/DnDProvider.svelte';
	import NodePalette from '$lib/palette/NodePalette.svelte';
	import CalmCanvas from '$lib/canvas/CalmCanvas.svelte';
	import CodePanel from '$lib/editor/CodePanel.svelte';
	import PropertiesPanel from '$lib/properties/PropertiesPanel.svelte';
	import Toolbar from '$lib/toolbar/Toolbar.svelte';
	import ValidationPanel from '$lib/validation/ValidationPanel.svelte';
	import C4Breadcrumb from '$lib/c4/C4Breadcrumb.svelte';
	import {
		isC4Mode,
		getC4Level,
		getC4Trail,
		getCurrentFrame,
		getActiveDocumentRef,
		enterC4,
		exitC4,
		drillIntoDocument,
		navigateUpTo,
	} from '$lib/c4/c4State.svelte';
	import {
		registerC4DemoSeries,
		registerC4Document,
		resolveC4Document,
		documentHasNode,
		clearC4Documents,
	} from '$lib/c4/c4Documents.svelte';
	import {
		filterEdgesForVisibleNodes,
		applyC4Styles,
		isDrillable,
		isInteractiveKeyTarget,
	} from '$lib/c4/c4Filter';
	import type { C4Level } from '$lib/c4/c4Filter';
	import { toggleTheme, isDark } from '$lib/stores/theme.svelte';
	import { getModelJson, applyFromJson, applyFromCanvas, getModel, resetModel, mergeDecorators } from '$lib/stores/calmModel.svelte';
	import { calmToFlow } from '$lib/stores/projection';
	import { pushSnapshot, resetHistory, undo, redo } from '$lib/stores/history.svelte';
	import { layoutCalm, type LayoutDirection } from '$lib/layout/elkLayout';
	import { openFile, saveFile, saveFileAs, saveSidecarAlongside, readSidecarAlongside } from '$lib/io/fileSystem';
	import {
		getFileName,
		getFileHandle,
		getIsDirty,
		markDirty,
		markClean,
		resetFileState,
		setFileName
	} from '$lib/io/fileState.svelte';
	import { isTauri } from '$lib/desktop/isTauri';
	import { updateWindowTitle } from '$lib/desktop/titleBar';
	import { buildAppMenu, updateRecentFilesMenu } from '$lib/desktop/menu';
	import { addRecentFile, getRecentFiles } from '$lib/desktop/recentFiles';
	import { startMcpSidecar, stopMcpSidecar } from '$lib/desktop/sidecarMcp';
	import { registerFileDrop } from '$lib/desktop/dragDrop';
	import { checkForUpdates } from '$lib/desktop/updater';
	import { registerFileOpenHandler } from '$lib/desktop/fileOpen';
	import { readTextFile } from '@tauri-apps/plugin-fs';
	import { exportAsCalm, exportAsSvg, exportAsPng, exportAsCalmscript, exportAsScalerToml, finalizeCalmForWrite, buildDecoratorSidecar, exportDesignAsZip } from '$lib/io/export';
	import { decoratorSidecarNameFor } from '$lib/io/sidecar';
	import { liftEmbeddedDecorators } from '$lib/io/decoratorMigration';
	import { readDocumentName } from '$lib/io/documentName';
	import { readLayout, type DiagramLayout } from '$lib/io/diagramLayout';
	import type { CalmArchitecture, CalmRelationship, CalmDecorator } from '@calmstudio/calm-core';
	import { GEMARA_ARCHITECTURE_SCOPE } from '@calmstudio/calm-core';
	import { detectPacksFromArch } from '$lib/io/sidecar';
	import {
		getIssues,
		getErrorCountForElement,
		getWarningCountForElement,
		getMaxSeverityForElement,
		isPanelOpen,
		closePanel,
		getScrollToElementId,
		setScrollToElementId,
		clearValidation,
		runValidation,
	} from '$lib/stores/validation.svelte';
	import {
		getActiveFlowId,
		setActiveFlowId,
		getActiveFlowEdgeIds,
		getFlowTransitionForEdge,
		isNodeInActiveFlow,
	} from '$lib/stores/flowState.svelte';

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	let canvas: CalmCanvas;

	// ─── Inspector pane: fold-to-close + auto-fit width per tab ────────────────
	type InspectorPaneApi = {
		collapse: () => void;
		expand: () => void;
		resize: (size: number) => void;
		getSize: () => number;
		isCollapsed: () => boolean;
		isExpanded: () => boolean;
		getId: () => string;
	};
	let inspectorPane = $state<InspectorPaneApi | undefined>();
	let inspectorCollapsed = $state(false);
	let activeInspectorTab = $state<'properties' | 'governance'>('properties');
	/** Remembered width (%) per tab — Governance needs more room than the Properties form. */
	const inspectorTabSize = { properties: 16, governance: 27 };

	// Size the inspector to the active tab, unless the user folded it shut.
	$effect(() => {
		const tab = activeInspectorTab;
		if (!inspectorPane || inspectorCollapsed) return;
		inspectorPane.resize(inspectorTabSize[tab]);
	});

	/** Remember a manual resize against the current tab (so switching back keeps it). */
	function handleInspectorResize(size: number) {
		if (!inspectorCollapsed && size > 0) inspectorTabSize[activeInspectorTab] = size;
	}

	// ─── Desktop: native title bar sync ───────────────────────────────────────

	// Reactively update the native OS window title when filename or dirty state changes.
	// Only active in Tauri desktop mode — no-ops in browser builds.
	$effect(() => {
		if (isTauri()) {
			updateWindowTitle(getFileName(), getIsDirty());
		}
	});

	// ─── C4 View Mode ─────────────────────────────────────────────────────────

	/** Saved viewport before entering C4 mode — restored on exit. */
	let savedViewport: Viewport | null = null;

	// ─── C4 navigation (one unified drill trail; the doc registry resolves links) ─
	/** Projection of the active LOADED document; empty when the root model is active. */
	let c4DocNodes = $state.raw<Node[]>([]);
	let c4DocEdges = $state.raw<Edge[]>([]);
	/** Transient hint (drill couldn't resolve, unreachable level, etc.). */
	let c4NavNotice = $state<string | null>(null);
	/** True while a navigated document's layout is being computed (suppresses an empty flash). */
	let c4DocLoading = $state(false);
	/** Monotonic guard so a slow layout can't overwrite a newer navigation. */
	let c4NavSeq = 0;
	let c4NavNoticeTimer: ReturnType<typeof setTimeout> | null = null;
	/** True while a document is loading — gates C4 buttons so a click can't race the load. */
	let importing = $state(false);
	/** Shows the dismissible "detailed views available" hint after a series loads. */
	let c4SeriesHint = $state(false);

	/** Reset all C4 navigation state (load/new/workspace-switch). */
	function resetC4Navigation() {
		if (isC4Mode()) exitC4();
		c4DocNodes = [];
		c4DocEdges = [];
		c4DocLoading = false;
		c4SeriesHint = false;
		setC4NavNotice(null);
		// NB: the document registry is NOT cleared here — it accumulates across
		// loads so links between session-opened files resolve. handleNew clears it.
	}

	/**
	 * The document currently shown in the canvas — the editable model normally, or
	 * the C4-drilled document when navigating. Drives the document-scoped decorator
	 * panel so it re-scopes as the shown document changes.
	 */
	const shownArchitecture = $derived.by((): CalmArchitecture => {
		if (isC4Mode()) {
			const ref = getActiveDocumentRef();
			if (ref) {
				const entry = resolveC4Document(ref);
				if (entry) return liveDocFor(ref, entry.doc);
			}
		}
		return getModel();
	});

	/** The active document's full projection — the loaded linked doc, or the root model. */
	function activeC4Nodes(): Node[] {
		return getActiveDocumentRef() ? c4DocNodes : nodes;
	}
	function activeC4Edges(): Edge[] {
		return getActiveDocumentRef() ? c4DocEdges : edges;
	}

	/** Show a transient navigation notice that auto-dismisses. */
	function setC4NavNotice(message: string | null) {
		if (c4NavNoticeTimer) {
			clearTimeout(c4NavNoticeTimer);
			c4NavNoticeTimer = null;
		}
		c4NavNotice = message;
		if (message) {
			c4NavNoticeTimer = setTimeout(() => {
				c4NavNotice = null;
				c4NavNoticeTimer = null;
			}, 4500);
		}
	}

	/**
	 * Derived C4 display nodes — the active document's full projection, styled for
	 * the current level. One file = one diagram; drilling jumps to a linked file.
	 */
	const c4DisplayNodes = $derived.by(() => {
		if (!isC4Mode()) return nodes;
		return applyC4Styles(activeC4Nodes(), getC4Level() ?? 'context');
	});

	/** Derived C4 display edges — the active document's edges, filtered to visible nodes. */
	const c4DisplayEdges = $derived.by(() => {
		if (!isC4Mode()) return edges;
		const visibleIds = new Set(c4DisplayNodes.map((n) => n.id));
		return filterEdgesForVisibleNodes(activeC4Edges(), visibleIds);
	});

	// ─── Validation ──────────────────────────────────────────────────────────

	/**
	 * Run validation on demand and enrich nodes/edges with results.
	 * Called by the Validate toolbar button.
	 */
	function handleValidate() {
		if (isPanelOpen()) {
			closePanel();
			clearNodeEdgeValidation();
			return;
		}
		runValidation();
		enrichNodesEdgesWithValidation();
	}

	/** Strip validation data from nodes/edges so badges and edge colors disappear. */
	function clearNodeEdgeValidation() {
		const clearedNodes = nodes.map((n) => {
			if (!n.data?.validationErrors && !n.data?.validationWarnings) return n;
			return { ...n, data: { ...n.data, validationErrors: 0, validationWarnings: 0 } };
		});
		if (clearedNodes.some((n, i) => n !== nodes[i])) nodes = clearedNodes;

		const clearedEdges = edges.map((e) => {
			if (!e.data?.validationSeverity) return e;
			return { ...e, data: { ...e.data, validationSeverity: null } };
		});
		if (clearedEdges.some((e, i) => e !== edges[i])) edges = clearedEdges;
	}

	/**
	 * Inject validation counts into nodes and edges for badge/color display.
	 * Only called after explicit validation run — not reactive.
	 */
	function enrichNodesEdgesWithValidation() {
		const currentIssues = getIssues();
		if (!currentIssues.length) {
			// Clear any previous validation data from nodes/edges
			const clearedNodes = nodes.map((n) => {
				if (n.data?.validationErrors === 0 && n.data?.validationWarnings === 0) return n;
				return { ...n, data: { ...n.data, validationErrors: 0, validationWarnings: 0 } };
			});
			if (clearedNodes.some((n, i) => n !== nodes[i])) nodes = clearedNodes;

			const clearedEdges = edges.map((e) => {
				if (e.data?.validationSeverity === null) return e;
				return { ...e, data: { ...e.data, validationSeverity: null } };
			});
			if (clearedEdges.some((e, i) => e !== edges[i])) edges = clearedEdges;
			return;
		}

		// Merge validation counts into nodes
		const nextNodes = nodes.map((n) => {
			const calmId = (n.data?.calmId as string) ?? n.id;
			const errs = getErrorCountForElement(calmId);
			const warns = getWarningCountForElement(calmId);
			if (n.data?.validationErrors === errs && n.data?.validationWarnings === warns) return n;
			return {
				...n,
				data: { ...n.data, validationErrors: errs, validationWarnings: warns },
			};
		});
		if (nextNodes.some((n, i) => n !== nodes[i])) nodes = nextNodes;

		// Merge validation severity into edges
		const nextEdges = edges.map((e) => {
			const calmId = (e.data?.calmId as string) ?? e.id;
			const sev = getMaxSeverityForElement(calmId);
			if (e.data?.validationSeverity === sev) return e;
			return {
				...e,
				data: { ...e.data, validationSeverity: sev },
			};
		});
		if (nextEdges.some((e, i) => e !== edges[i])) edges = nextEdges;
	}

	// ─── C4 compact layout ──────────────────────────────────────────────────

	/**
	 * Runs ELK layout on the C4-filtered CALM subset so nodes are positioned
	 * compactly instead of retaining scattered "All" positions.
	 */
	// ─── C4 navigation: one unified drill ─────────────────────────────────────

	/** Live-region announcement of the current C4 location (a11y). */
	let c4LiveMessage = $state('');
	function announceActive() {
		const f = getCurrentFrame();
		c4LiveMessage = f ? `${f.level[0]!.toUpperCase()}${f.level.slice(1)} view: ${f.label}` : '';
	}

	/** A document's declared C4 level (metadata.c4-level), if valid. */
	function readModelC4Level(meta: unknown): C4Level | undefined {
		const obj = Array.isArray(meta)
			? Object.assign({}, ...meta.filter((m) => m && typeof m === 'object'))
			: meta && typeof meta === 'object'
				? (meta as Record<string, unknown>)
				: {};
		const lvl = (obj as Record<string, unknown>)['c4-level'];
		return lvl === 'context' || lvl === 'container' || lvl === 'component' ? lvl : undefined;
	}

	/**
	 * Tag nodes that link to another document (a resolvable detailed-architecture)
	 * so they show the drill affordance in both the editable and read-only views.
	 */
	function markDrillableNodes(list: Node[]): Node[] {
		const resolves = (ref: string) => resolveC4Document(ref) !== undefined;
		return list.map((n) => {
			const drillable = isDrillable(n, resolves);
			const existing = typeof n.class === 'string' ? n.class : '';
			const classes = existing.split(' ').filter((c) => c && c !== 'c4-drillable');
			if (drillable) classes.push('c4-drillable');
			return {
				...n,
				class: classes.length ? classes.join(' ') : undefined,
				data: { ...n.data, c4Drillable: drillable },
			};
		});
	}

	/**
	 * Resolve the document to display for a ref. If the link targets the file
	 * currently open for editing, use the live model so the drill reflects unsaved
	 * edits — the registered snapshot is only as fresh as the last load/save.
	 */
	function liveDocFor(ref: string, snapshot: CalmArchitecture): CalmArchitecture {
		return ref === getFileName() ? getModel() : snapshot;
	}

	/** Load a linked document into the read-only C4 view (with a stale-write guard). */
	async function projectDocIntoC4View(doc: CalmArchitecture) {
		const seq = ++c4NavSeq;
		c4DocLoading = true;
		const positionMap = await layoutCalm(doc, new Set(), 'DOWN');
		if (seq !== c4NavSeq) return; // superseded by a newer navigation
		const projected = calmToFlow(doc, positionMap);
		c4DocNodes = markDrillableNodes(projected.nodes);
		c4DocEdges = projected.edges;
		c4DocLoading = false;
		announceActive();
		await tick();
		if (seq === c4NavSeq) canvas?.fitViewport?.();
	}

	/** Enter the read-only navigation rooted at the currently-loaded (editable) document. */
	function enterC4ForCurrentDoc() {
		savedViewport = canvas?.saveViewport?.() ?? null;
		const model = getModel();
		enterC4(model.nodes?.[0]?.name ?? 'Architecture', readModelC4Level(model.metadata) ?? 'context');
		announceActive();
	}

	function exitC4AndRestore() {
		exitC4();
		c4DocNodes = [];
		c4DocEdges = [];
		c4DocLoading = false;
		setC4NavNotice(null);
		tick().then(() => {
			if (savedViewport) {
				canvas?.restoreViewport?.(savedViewport);
				savedViewport = null;
			}
		});
	}

	/** Drill a node into its linked document (details.detailed-architecture). */
	function handleC4Drill(node: Node) {
		if (importing || !isC4Mode()) return;
		const ref = (node.data?.details as { 'detailed-architecture'?: string } | undefined)?.[
			'detailed-architecture'
		];
		if (!ref) return; // not a link — nothing to drill
		const target = resolveC4Document(ref);
		if (!target) {
			setC4NavNotice('That node links to a document that isn’t loaded in this session.');
			return;
		}
		const nodeId = String(node.data?.calmId ?? node.id);
		if (!documentHasNode(target.doc, nodeId)) {
			console.warn(`[c4] linked document ${ref} has no node "${nodeId}" — identity continuity broken`);
		}
		const label = String(node.data?.label ?? nodeId);
		const lvl = drillIntoDocument(ref, label, target.level);
		if (lvl === null) {
			setC4NavNotice(`“${label}” is already in the trail.`);
			return;
		}
		setC4NavNotice(null);
		c4SeriesHint = false;
		projectDocIntoC4View(liveDocFor(ref, target.doc));
	}

	/** Editable-canvas double-click: if the node links out, enter navigation and follow it. */
	function handleNodeDoubleClick(node: Node) {
		if (importing) return;
		const resolves = (r: string) => resolveC4Document(r) !== undefined;
		if (!isDrillable(node, resolves)) return;
		enterC4ForCurrentDoc();
		handleC4Drill(node);
	}

	/** Drill the selected node via keyboard (Enter/Space) — parity with double-click. */
	function handleC4KeyDrill() {
		if (c4SelectedNode) handleC4Drill(c4SelectedNode);
	}

	/**
	 * Canvas-region keyboard: Enter/Space drills the selected C4 node — but NOT
	 * when the key was aimed at a focused control (a breadcrumb button, an input),
	 * so activating a breadcrumb doesn't also fire a drill in the opposite direction.
	 */
	function handleCanvasKeydown(e: KeyboardEvent) {
		if (!isC4Mode() || !c4SelectedNode) return;
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (isInteractiveKeyTarget(e.target as HTMLElement | null)) return;
		e.preventDefault();
		handleC4KeyDrill();
	}

	function handleBreadcrumbNavigate(index: number) {
		const frame = navigateUpTo(index);
		// The root crumb is the editable document — returning to it exits navigation.
		if (!frame || frame.ref === null) {
			exitC4AndRestore();
			return;
		}
		const target = resolveC4Document(frame.ref);
		if (target) projectDocIntoC4View(liveDocFor(frame.ref, target.doc));
	}

	/**
	 * Bridge from the read-only C4 view to editing: load the document currently in
	 * view onto the editable canvas so the user can apply governance to its nodes.
	 */
	async function handleEditCurrentDoc() {
		const ref = getActiveDocumentRef();
		const target = ref ? resolveC4Document(ref) : undefined;
		if (!target) return;
		exitC4();
		c4DocNodes = [];
		c4DocEdges = [];
		c4DocLoading = false;
		pushSnapshot(nodes, edges);
		applyFromJson(target.doc);
		const positionMap = await layoutCalm(target.doc, new Set(), 'DOWN');
		const projected = calmToFlow(target.doc, positionMap);
		nodes = markDrillableNodes(projected.nodes);
		edges = projected.edges;
		// A layer sub-document, not the user's saved file — mark dirty so the unsaved
		// indicator persists and a Save prompts for its own filename.
		markDirty();
		setC4NavNotice(`Editing ${target.title}. Apply governance from the inspector, or drill again.`);
		await tick();
		canvas?.fitViewport?.();
	}

	// ─── Import error state — set by importCalmFile on invalid JSON ──────────

	let importError = $state<string | null>(null);

	// ─── Extension pack banner state — shown when pack types detected on import ─

	/**
	 * When true, a dismissable info banner appears below the toolbar telling the
	 * user that extension pack types were detected in the imported file.
	 * Since initAllPacks() runs at module startup, packs are always loaded —
	 * the banner is informational only (v1).
	 */
	let extensionPackBanner = $state(false);

	/**
	 * Set after a browser save where decorators were written to a SEPARATE
	 * download (no FSA sibling access). Drives a one-time notice telling the user
	 * the sidecar won't auto-reload and to use Export → .zip to keep them together.
	 */
	let decoratorDownloadNotice = $state(false);

	// ─── Template picker state ────────────────────────────────────────────────

	/** When true, the full-screen TemplatePicker modal is shown. */
	let showTemplatePicker = $state(false);

	/**
	 * Load a template onto the canvas.
	 * If the canvas has content, prompts the user to confirm overwrite.
	 * Strips _template metadata via registry.loadTemplate(), then applies like a file import.
	 */
	async function handleTemplateLoad(templateId: string) {
		// Dirty-state guard — templates replace the whole canvas
		if (getIsDirty() || nodes.length > 0) {
			const confirmed = window.confirm('You have unsaved changes. Load template anyway?');
			if (!confirmed) return;
		}

		showTemplatePicker = false;

		// loadTemplate returns clean CalmArchitecture without _template
		const arch = loadTemplate(templateId);

		// Apply as if it were a file import — reuse importCalmFile logic
		await importCalmFile(JSON.stringify(arch));

		// The multi-agent reference architecture is a linked C4 document series:
		// register it so a node's detailed-architecture drills resolve.
		if (templateId === 'multi-agent-ref-arch') {
			registerC4DemoSeries();
			c4SeriesHint = true; // invite the user to drill in
		}
		nodes = markDrillableNodes(nodes); // affordance for linked + composed-of nodes
		// File binding (clean slate / restore metadata.name) is handled in importCalmFile.
	}

	function handlePalettePlace(type: string) {
		canvas?.placeNodeAtCenter(type);
	}

	// ─── Forward sync: model -> JSON string for code panel ───────────────────

	// The code viewer reflects the two-document split: the main panel shows the
	// architecture WITHOUT decorators (as it's written to disk), and a separate
	// read-only panel shows the decorators document — shown only when present.
	const decoratorsForDoc = $derived(getModel().decorators ?? []);
	const hasDecoratorsDoc = $derived(decoratorsForDoc.length > 0);
	const decoratorsDocJson = $derived(
		hasDecoratorsDoc ? JSON.stringify({ decorators: decoratorsForDoc }, null, 2) : '',
	);
	const mainDocJson = $derived.by(() => {
		const raw = getModelJson();
		try {
			const parsed = JSON.parse(raw) as { decorators?: unknown };
			delete parsed.decorators;
			return JSON.stringify(parsed, null, 2);
		} catch {
			return raw;
		}
	});

	// True when a decorator is bound at architecture scope — drives the thin
	// frame around the whole diagram signifying a document-wide decorator.
	const hasArchDecorator = $derived(
		(getModel().decorators ?? []).some((d) => d['applies-to'].includes(GEMARA_ARCHITECTURE_SCOPE))
	);

	// ─── Selection state ─────────────────────────────────────────────────────

	let selectedNodeId = $state<string | null>(null);
	let selectedEdgeId = $state<string | null>(null);

	// Derive selected node/edge objects for properties panel
	const selectedNode = $derived(
		selectedNodeId ? nodes.find((n) => n.data?.calmId === selectedNodeId) ?? null : null
	);
	const selectedEdge = $derived(
		selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null
	);

	/** The selected node within the C4 view (for keyboard drill). */
	const c4SelectedNode = $derived(
		isC4Mode() && selectedNodeId
			? c4DisplayNodes.find((n) => n.data?.calmId === selectedNodeId || n.id === selectedNodeId) ?? null
			: null
	);

	/** In C4 mode, which level buttons are reachable in the current trail (others disabled). */

	function handleSelectionChange(nodeId: string | null, edgeId: string | null) {
		selectedNodeId = nodeId;
		selectedEdgeId = edgeId;
	}

	// ─── Validation panel navigation ──────────────────────────────────────────

	/**
	 * Called when user clicks an issue row in the ValidationPanel.
	 * Centers canvas on the element and selects it.
	 */
	function handleNavigateToNode(elementId: string) {
		// Check nodes first
		const node = nodes.find(
			(n) => (n.data?.calmId as string) === elementId || n.id === elementId
		);
		if (node) {
			selectedNodeId = (node.data?.calmId as string) ?? null;
			selectedEdgeId = null;
			canvas?.navigateToNode(elementId);
			// Clear scroll-to after navigation
			setScrollToElementId(null);
			return;
		}
		// Check edges
		const edge = edges.find(
			(e) => (e.data?.calmId as string) === elementId || e.id === elementId
		);
		if (edge) {
			selectedEdgeId = (edge.data?.calmId as string) ?? edge.id;
			selectedNodeId = null;
			setScrollToElementId(null);
		}
	}

	// ─── Reverse sync: code editor -> model -> canvas ────────────────────────

	let codeParseError = $state<string | null>(null);
	let codeChangeTimer: ReturnType<typeof setTimeout>;

	function handleCodeChange(newValue: string) {
		// Debounce: wait 400ms after last change before parsing
		clearTimeout(codeChangeTimer);
		codeChangeTimer = setTimeout(() => {
			try {
				const parsed = JSON.parse(newValue) as CalmArchitecture;
				codeParseError = null;

				// The main panel doesn't show decorators (they live in their own
				// document/panel), so carry the current ones across the edit rather
				// than letting applyFromJson drop them.
				const keepDecorators = getModel().decorators;
				if (keepDecorators && keepDecorators.length > 0) {
					(parsed as CalmArchitecture).decorators = keepDecorators;
				}

				// Build position map from current nodes to preserve positions
				const positionMap = new Map<string, { x: number; y: number }>();
				for (const n of nodes) {
					if (n.data?.calmId) {
						positionMap.set(n.data.calmId as string, { ...n.position });
					}
				}

				// Push undo snapshot BEFORE applying
				pushSnapshot(nodes, edges);

				// Apply to canonical model (mutex prevents re-entry)
				const applied = applyFromJson(parsed);
				if (applied) {
					// Project back to Svelte Flow format, preserving positions and selection
					const projected = calmToFlow(parsed, positionMap);
					const selectionMap = new Map<string, boolean>();
					for (const n of nodes) {
						if (n.selected && n.data?.calmId) selectionMap.set(n.data.calmId as string, true);
					}
					nodes = projected.nodes.map((n) =>
						selectionMap.has(n.data?.calmId as string)
							? { ...n, selected: true }
							: n
					);
					edges = projected.edges;

					// Mark dirty on code-driven changes
					markDirty();
				}
			} catch (e) {
				codeParseError = (e as Error).message;
				// Canvas keeps last valid state — no update
			}
		}, 400);
	}

	// ─── Properties panel mutation callback ──────────────────────────────────

	/**
	 * Called by PropertiesPanel after a property mutation updates the model store.
	 * Re-projects the canonical model back to Svelte Flow nodes/edges to keep
	 * canvas and code panel in sync.
	 */
	function handlePropertyMutation() {
		const model = getModel();
		const positionMap = new Map<string, { x: number; y: number; width?: number; height?: number }>();
		const selectionMap = new Map<string, boolean>();
		for (const n of nodes) {
			if (n.data?.calmId) {
				positionMap.set(n.data.calmId as string, {
					...n.position,
					width: n.measured?.width ?? n.width,
					height: n.measured?.height ?? n.height,
				});
				if (n.selected) selectionMap.set(n.data.calmId as string, true);
			}
		}

		const projected = calmToFlow(model, positionMap);
		// Preserve node selection state so SvelteFlow doesn't fire deselection;
		// re-mark drill affordances in case a details link was just authored.
		nodes = markDrillableNodes(projected.nodes).map((n) =>
			selectionMap.has(n.data?.calmId as string)
				? { ...n, selected: true }
				: n
		);

		// Update edge data in place rather than replacing the array.
		// Replacing edges causes Svelte Flow to lose internal state (selection,
		// animation, hover) which makes edges disappear or deselect.
		const modelRelMap = new Map<string, CalmRelationship>();
		for (const r of model.relationships) {
			modelRelMap.set(r['unique-id'], r);
		}
		edges = edges.map((e) => {
			// In CALM 1.2 nested form, an edge id may be a derived suffix
			// (`<base>#<i>`) when a single CalmRelationship expanded to N edges.
			// Look up via the original calmRelId stamped during projection,
			// falling back to the literal edge id for backward compatibility.
			const calmId = (e.data as { calmRelId?: string })?.calmRelId ?? e.id;
			const rel = modelRelMap.get(calmId);
			if (rel) {
				const rt = rel['relationship-type'];
				const variant =
					'connects' in rt ? 'connects'
					: 'composed-of' in rt ? 'composed-of'
					: 'interacts' in rt ? 'interacts'
					: 'deployed-in' in rt ? 'deployed-in'
					: 'options';
				return {
					...e,
					type: variant,
					data: {
						...e.data,
						calmRelId: calmId,
						calmVariant: variant,
						protocol: rel.protocol ?? '',
						description: rel.description ?? '',
					},
				};
			}
			return e;
		});

		// Mark dirty on property mutations
		markDirty();
	}

	/**
	 * Called by PropertiesPanel before the first mutation in a selection session.
	 * Pushes an undo snapshot so property edits can be undone as a group.
	 */
	function handleBeforeFirstEdit() {
		pushSnapshot(nodes, edges);
	}

	// ─── Pin toggle ──────────────────────────────────────────────────────────

	function handleTogglePin(nodeId: string) {
		nodes = nodes.map((n) =>
			n.id === nodeId
				? { ...n, data: { ...n.data, pinned: !n.data?.pinned } }
				: n
		);
		applyFromCanvas(nodes, edges);
	}

	// ─── CALM file import ─────────────────────────────────────────────────────

	/**
	 * Import a CALM JSON file from string content.
	 * Validates JSON and presence of `nodes` array.
	 * On success: applies to model, runs ELK layout, projects to canvas, fits view.
	 * On error: sets importError, canvas unchanged (no partial load).
	 */
	async function importCalmFile(
		content: string,
		_filename?: string,
		handle?: FileSystemFileHandle | string | null,
	) {
		let parsed: CalmArchitecture;
		try {
			parsed = JSON.parse(content) as CalmArchitecture;
		} catch (e) {
			importError = 'Malformed JSON: ' + (e as Error).message;
			return;
		}

		if (!Array.isArray(parsed.nodes)) {
			importError = 'Invalid CALM JSON: missing nodes array';
			return;
		}

		// Loading a document resets any cross-document C4 navigation. handleTemplateLoad
		// re-enables it for the reference series after this returns. `importing` gates
		// the C4 buttons so a click during the async load can't race the reset.
		importing = true;
		resetC4Navigation();

		// Clear any previous error and banner
		importError = null;
		extensionPackBanner = false;

		// Clear previous validation results on new file load
		clearValidation();

		// Detect extension pack types — show info banner if pack-prefixed types found.
		// All packs are already registered (initAllPacks ran at module load), so this
		// is purely informational for v1.
		const detectedPacks = detectPacksFromArch(parsed);
		if (detectedPacks.length > 0) {
			extensionPackBanner = true;
		}

		// Push undo snapshot before mutation
		pushSnapshot(nodes, edges);

		// Migrate any legacy embedded decorators out of the document body and into
		// the model's decorator set via the merge path, so decorators always arrive
		// through one channel (embedded + sidecar, unioned). `applyFromJson` gets the
		// decorator-free document; the C4 registry keeps the original (so a drilled
		// doc still shows its own embedded decorators).
		const { arch: parsedClean, decorators: embeddedDecorators } = liftEmbeddedDecorators(parsed);

		// Apply to canonical model
		applyFromJson(parsedClean);
		if (embeddedDecorators.length > 0) mergeDecorators(embeddedDecorators);

		// Merge the standalone `*.decorators.json` sidecar when we have a file
		// handle to read its sibling (desktop / FSA). Centralised here so every open
		// path — file open, recent-files, path open — picks it up uniformly.
		if (handle && _filename) await loadDecoratorSidecar(handle, _filename);

		// File binding. Callers with a real filename (open / demo / hub) set name +
		// handle themselves afterwards. For nameless loads (paste / template), start
		// from a clean slate and restore any persisted document name from metadata,
		// so the title survives content-only round trips, not just file opens.
		if (!_filename) {
			resetFileState();
			const docName = readDocumentName(parsed);
			if (docName) markClean(docName);
		}

		// Register this document in the session by its filename, so other open
		// files whose nodes link to it (details.detailed-architecture) resolve.
		if (_filename) registerC4Document(_filename, parsed);

		// Auto-layout with no pinned nodes on fresh import, then restore any saved
		// arrangement (metadata.calmstudio-layout) over the top — so a doc the user
		// arranged in Studio reopens as they left it, while nodes without a saved
		// position (e.g. authored elsewhere) keep their auto-layout placement.
		const positionMap = await layoutCalm(parsed, new Set(), 'DOWN');
		for (const [id, pos] of Object.entries(readLayout(parsed))) {
			const existing = positionMap.get(id);
			positionMap.set(id, existing ? { ...existing, x: pos.x, y: pos.y } : { x: pos.x, y: pos.y });
		}

		// Project to Svelte Flow — mark nodes drillable (links that resolve to a
		// registered document).
		const projected = calmToFlow(parsed, positionMap);
		nodes = markDrillableNodes(projected.nodes);
		edges = projected.edges;

		// Fit view after DOM update
		await tick();
		canvas?.fitViewport();
		importing = false;
	}

	// ─── File operations ──────────────────────────────────────────────────────

	/**
	 * Load the `*.decorators.json` sidecar that sits next to a just-opened
	 * architecture and merge it into the model. Only resolves on desktop (Tauri
	 * reads the sibling by path); in the browser a single-file open has no sibling
	 * access (see readSidecarAlongside), so this is a no-op there — zip-open is the
	 * browser round-trip path. Legacy embedded decorators are already in the model
	 * (applyFromJson preserves them); this unions the sidecar on top.
	 */
	async function loadDecoratorSidecar(
		handle: FileSystemFileHandle | string | null,
		archName: string,
	) {
		try {
			const text = await readSidecarAlongside(handle, decoratorSidecarNameFor(archName));
			if (!text) return;
			const parsed = JSON.parse(text) as { decorators?: CalmDecorator[] };
			if (parsed.decorators?.length) mergeDecorators(parsed.decorators);
		} catch (e) {
			console.warn('Failed to load decorator sidecar:', e);
		}
	}

	async function handleOpen() {
		try {
			const result = await openFile();
			await importCalmFile(result.content, result.name, result.handle);
			// On success, importCalmFile clears importError; mark clean with new file info
			markClean(result.name, result.handle);
			// Desktop: add to recent files and refresh menu
			if (isTauri() && typeof result.handle === 'string') {
				const recent = await addRecentFile(result.handle);
				await updateRecentFilesMenu(recent);
			}
		} catch (e) {
			// User cancelled the file picker — not an error
		}
	}

	async function handleLoadDemo(demo: { id: string; name: string; path: string }) {
		const response = await fetch(demo.path);
		const content = await response.text();
		await importCalmFile(content, demo.name);
		markClean(demo.name + '.calm.json', null);
	}

	/** Current canvas arrangement as a node-id → {x,y} map, persisted on save. */
	function layoutFromCanvas(): DiagramLayout {
		const layout: DiagramLayout = {};
		for (const n of nodes) {
			layout[String(n.data?.calmId ?? n.id)] = {
				x: Math.round(n.position.x),
				y: Math.round(n.position.y),
			};
		}
		return layout;
	}

	/** Re-register the active document under its (current) filename after a save. */
	function registerActiveDocument() {
		const name = getFileName();
		if (name) registerC4Document(name, getModel());
	}

	/**
	 * The display filename from a save result — Tauri path string, browser FSA
	 * handle, or null (Blob download / cancel). Used to update the title bar so a
	 * first Save of a fresh document shows the chosen name (not "Unsaved Document").
	 */
	function nameFromSaveResult(handle: FileSystemFileHandle | string | null): string | undefined {
		if (typeof handle === 'string') return handle.split(/[\\/]/).pop() ?? undefined;
		if (handle) return handle.name ?? undefined;
		return undefined;
	}

	/**
	 * Write the `*.decorators.json` sidecar next to a just-saved architecture.
	 * Decorators are stripped from the arch file by `finalizeCalmForWrite`, so
	 * this is where they're persisted. No-op when the document has none. Built
	 * from the raw model JSON (pre-strip), with `target` stamped to the saved
	 * filename. Failure is logged, not thrown — the arch file is already written.
	 */
	async function persistDecoratorSidecar(
		modelJson: string,
		handle: FileSystemFileHandle | string | null,
		archName: string,
	) {
		const sidecar = buildDecoratorSidecar(modelJson, archName);
		if (!sidecar) return;
		try {
			await saveSidecarAlongside(sidecar, handle, decoratorSidecarNameFor(archName));
			// On desktop (Tauri) the sidecar is written in-place next to the arch and
			// re-read on open. In the browser there's no sibling access, so it comes
			// down as a SEPARATE download and won't be auto-loaded on reopen — surface
			// that so the user isn't surprised and knows to use Export → .zip.
			if (!isTauri()) decoratorDownloadNotice = true;
		} catch (e) {
			console.warn('Failed to write decorator sidecar:', e);
		}
	}

	async function handleSave() {
		try {
			const modelJson = getModelJson();
			const json = finalizeCalmForWrite(modelJson, getFileName(), layoutFromCanvas());
			const handle = await saveFile(json, getFileHandle(), getFileName() ?? 'architecture.calm.json');
			const savedName = nameFromSaveResult(handle) ?? getFileName() ?? 'architecture.calm.json';
			await persistDecoratorSidecar(modelJson, handle, savedName);
			markClean(savedName, handle);
			registerActiveDocument();
		} catch (e) {
			// User cancelled or save failed — remain dirty
		}
	}

	async function handleSaveAs() {
		try {
			const modelJson = getModelJson();
			const json = finalizeCalmForWrite(modelJson, getFileName(), layoutFromCanvas());
			const handle = await saveFileAs(json, getFileName() ?? 'architecture.calm.json');
			// saveFileAs returns a Tauri path, a browser FSA handle, or null (Blob/cancel).
			const savedName = nameFromSaveResult(handle) ?? getFileName() ?? 'architecture.calm.json';
			await persistDecoratorSidecar(modelJson, handle, savedName);
			if (handle === null) {
				markClean(); // Blob download — content "saved", no bound file
			} else {
				markClean(savedName, handle);
			}
			registerActiveDocument();
		} catch (e) {
			// User cancelled or save failed — remain dirty
		}
	}

	async function handleNew() {
		if (getIsDirty()) {
			const confirmed = window.confirm('You have unsaved changes. Continue without saving?');
			if (!confirmed) return;
		}
		resetModel();
		resetHistory();
		resetFileState();
		clearValidation();
		resetC4Navigation(); // don't leave a stale C4 trail on the empty canvas
		clearC4Documents(); // a new workspace starts with no registered documents
		nodes = [];
		edges = [];
	}

	// ─── Desktop: open file from path (drag-drop, file association, recent files) ─

	/**
	 * Open a .calm.json file given an absolute path (Tauri desktop only).
	 * Used by drag-drop, single-instance file association, macOS deep-link,
	 * and recent file menu items.
	 */
	async function handleOpenFromPath(path: string) {
		try {
			const content = await readTextFile(path);
			const name = path.split(/[\\/]/).pop() ?? path;
			await importCalmFile(content, name, path);
			markClean(name, path);
			const recent = await addRecentFile(path);
			await updateRecentFilesMenu(recent);
		} catch (e) {
			console.error('Failed to open file from path:', e);
		}
	}

	// ─── Desktop: native feature initialization (onMount) ─────────────────────

	onMount(() => {
		if (!isTauri()) return;

		const cleanups: (() => void)[] = [];

		// 1. Build native menu bar
		void buildAppMenu({
			open: handleOpen,
			openFromPath: handleOpenFromPath,
			save: handleSave,
			saveAs: handleSaveAs,
			newFile: handleNew,
			exportCalm: handleExportCalm,
			exportSvg: handleExportSvg,
			exportPng: handleExportPng,
			undo: () => {
				const snapshot = undo();
				if (snapshot) {
					applyFromJson(snapshot.model); // restore decorators/controls the flow doesn't hold
					nodes = snapshot.nodes;
					edges = snapshot.edges;
				}
			},
			redo: () => {
				const snapshot = redo();
				if (snapshot) {
					applyFromJson(snapshot.model);
					nodes = snapshot.nodes;
					edges = snapshot.edges;
				}
			},
			zoomIn: () => { /* TODO: wire to canvas zoom via useSvelteFlow */ },
			zoomOut: () => { /* TODO: wire to canvas zoom via useSvelteFlow */ },
			zoomFit: () => { canvas?.fitViewport(); },
			togglePalette: () => { /* TODO: expose palette visibility state */ },
			toggleCode: () => { /* TODO: expose code panel visibility state */ },
			toggleProperties: () => { /* TODO: expose properties panel visibility state */ },
			about: () => {
				alert('CalmStudio v0.1.0\nVisual CALM Architecture Editor\nhttps://calmstudio.dev');
			},
			docs: () => { window.open('https://calmstudio.dev/docs', '_blank'); },
		});

		// 2. Register drag-and-drop (.calm.json files dropped onto app window)
		const unlistenDrop = registerFileDrop(handleOpenFromPath);
		cleanups.push(unlistenDrop);

		// 3. Register file-open events (single-instance on Windows/Linux + macOS cold-start)
		const unlistenFileOpen = registerFileOpenHandler(handleOpenFromPath);
		cleanups.push(unlistenFileOpen);

		// 4. Start MCP sidecar (fire-and-forget — never blocks startup)
		startMcpSidecar().catch((e) => console.warn('MCP sidecar failed to start:', e));

		// 5. Check for updates (fire-and-forget — never blocks startup)
		checkForUpdates().catch((e) => console.warn('Update check failed:', e));

		// 6. Populate recent files in menu on startup
		void getRecentFiles().then((recent) => {
			if (recent.length > 0) {
				void updateRecentFilesMenu(recent);
			}
		});

		return () => {
			cleanups.forEach((fn) => fn());
			stopMcpSidecar().catch(() => {});
		};
	});

	// ─── Export operations ────────────────────────────────────────────────────

	function handleExportCalm() {
		exportAsCalm(getModelJson());
	}

	/** Bundle the design (architecture + decorator/pack sidecars) into one .zip. */
	function handleExportZip() {
		// Use a bare basename for the in-archive filename — a renamed doc title can
		// contain slashes, which are invalid as ZIP entry names.
		const archName = (getFileName() ?? 'architecture.calm.json').split(/[\\/]/).pop() ?? 'architecture.calm.json';
		exportDesignAsZip(getModelJson(), archName, getFileName(), layoutFromCanvas());
	}

	async function handleExportSvg() {
		await exportAsSvg(nodes);
	}

	async function handleExportPng() {
		await exportAsPng(nodes);
	}

	function handleExportCalmscript() {
		// Phase 4 stub: export CALM JSON with a header comment — Phase 5 will provide real calmscript
		const json = getModelJson();
		exportAsCalmscript(`// calmscript export — full DSL support coming in Phase 5\n// CALM JSON representation:\n${json}\n`);
	}

	function handleExportScalerToml() {
		const arch = JSON.parse(getModelJson()) as CalmArchitecture;
		exportAsScalerToml(arch);
	}

	// Reactive: show Scaler.toml export only when canvas has opengris: nodes.
	// $derived re-evaluates whenever the reactive $state model changes.
	const showScalerTomlExport = $derived(
		getModel().nodes.some(n => n['node-type'].startsWith('opengris:'))
	);

	// ─── Flow visualization ───────────────────────────────────────────────────

	/** Flow items for the toolbar dropdown: derived from the loaded architecture. */
	const flows = $derived(
		(getModel().flows ?? []).map(f => ({ id: f['unique-id'], name: f.name }))
	);

	/** Currently active flow ID — read from the reactive flow store. */
	const activeFlowId = $derived(getActiveFlowId());

	/** Set of edge unique-IDs that are part of the active flow. */
	const activeFlowEdgeIds = $derived(getActiveFlowEdgeIds(getModel()));

	/**
	 * Reactively inject/remove flow visualization data into the live edges[] and nodes[] state.
	 * This mirrors the validation enrichment pattern: directly mutates the $state.raw arrays
	 * so SvelteFlow re-renders edges with flowTransition/dimmed data from their data prop.
	 *
	 * Using $effect ensures this runs whenever activeFlowId or the arch model changes.
	 */
	$effect(() => {
		const currentActiveFlowId = activeFlowId;
		const arch = getModel();

		if (!currentActiveFlowId) {
			// Clear flow data from all edges
			const cleared = edges.map((e) => {
				if (!e.data?.flowTransition && !e.data?.dimmed) return e;
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { flowTransition: _ft, dimmed: _d, ...restData } = (e.data ?? {}) as Record<string, unknown>;
				return { ...e, data: restData };
			});
			if (cleared.some((e, i) => e !== edges[i])) edges = cleared;

			// Clear node dimming
			const clearedNodes = nodes.map((n) => {
				if (!n.style?.includes('opacity: 0.3')) return n;
				const newStyle = (n.style ?? '').replace(/\s*opacity:\s*0\.3\s*;?/g, '').trim();
				return { ...n, style: newStyle || undefined };
			});
			if (clearedNodes.some((n, i) => n !== nodes[i])) nodes = clearedNodes;
			return;
		}

		// Inject flow transition data into edges
		const enrichedEdges = edges.map((e) => {
			const transition = getFlowTransitionForEdge(arch, e.id);
			const isDimmed = !activeFlowEdgeIds.has(e.id);
			const current = e.data as Record<string, unknown> | undefined;
			const sameTransition = current?.flowTransition === (transition ?? null);
			const sameDimmed = current?.dimmed === isDimmed;
			if (sameTransition && sameDimmed) return e;
			return { ...e, data: { ...e.data, flowTransition: transition ?? null, dimmed: isDimmed } };
		});
		if (enrichedEdges.some((e, i) => e !== edges[i])) edges = enrichedEdges;

		// Apply/remove node dimming via style
		const enrichedNodes = nodes.map((n) => {
			const nodeId = (n.data?.calmId as string) ?? n.id;
			const inFlow = isNodeInActiveFlow(arch, nodeId);
			const hasDimStyle = n.style?.includes('opacity: 0.3') ?? false;
			if (!inFlow && !hasDimStyle) {
				const existingStyle = n.style ?? '';
				return { ...n, style: `${existingStyle} opacity: 0.3;`.trim() };
			}
			if (inFlow && hasDimStyle) {
				const newStyle = (n.style ?? '').replace(/\s*opacity:\s*0\.3\s*;?/g, '').trim();
				return { ...n, style: newStyle || undefined };
			}
			return n;
		});
		if (enrichedNodes.some((n, i) => n !== nodes[i])) nodes = enrichedNodes;
	});

	// ─── Auto-layout ──────────────────────────────────────────────────────────

	/** Currently selected layout direction (used by toolbar dropdown). */
	let layoutDirection = $state<LayoutDirection>('DOWN');

	/**
	 * Run ELK auto-layout on the current diagram.
	 * Pinned nodes are excluded from ELK; their current positions are preserved.
	 */
	async function runLayout(direction: LayoutDirection) {
		const model = getModel();
		const pinnedIds = new Set(
			nodes.filter((n) => n.data?.pinned).map((n) => n.id)
		);

		// Run ELK for free (unpinned) nodes
		const elkPositions = await layoutCalm(model, pinnedIds, direction);

		// Build final position map: ELK results + pinned node current positions
		const finalPositions = new Map<string, { x: number; y: number }>();

		// Inject pinned positions from current canvas state
		for (const n of nodes) {
			if (pinnedIds.has(n.id)) {
				finalPositions.set(n.id, { ...n.position });
			}
		}

		// Add ELK-computed positions for free nodes
		for (const [id, pos] of elkPositions) {
			finalPositions.set(id, pos);
		}

		// Project via calmToFlow with combined position map
		const projected = calmToFlow(model, finalPositions);

		// Preserve pinned flag on projected nodes
		const pinnedMap = new Map(nodes.map((n) => [n.id, n.data?.pinned ?? false]));
		nodes = projected.nodes.map((n) =>
			pinnedMap.get(n.id) ? { ...n, data: { ...n.data, pinned: true } } : n
		);
		edges = projected.edges;

		await tick();
		canvas?.fitViewport();
	}

	// ─── Keyboard shortcuts and beforeunload ──────────────────────────────────

	onMount(() => {
		function handleKeydown(e: KeyboardEvent) {
			// Option+N (Mac) / Alt+N: new diagram
			// Use e.code because Option+N produces 'ñ' for e.key on Mac
			if (e.altKey && e.code === 'KeyN') {
				e.preventDefault();
				handleNew();
				return;
			}

			const isMod = e.metaKey || e.ctrlKey;
			if (!isMod) return;

			if (e.key === 'o') {
				e.preventDefault();
				handleOpen();
			} else if (e.key === 's' && !e.shiftKey) {
				e.preventDefault();
				handleSave();
			} else if (e.key === 's' && e.shiftKey) {
				e.preventDefault();
				handleSaveAs();
			}
		}

		// Use capture phase so we intercept before browser processes Cmd+N/Cmd+O
		window.addEventListener('keydown', handleKeydown, true);

		return () => {
			window.removeEventListener('keydown', handleKeydown, true);
		};
	});

	// ─── Document title + beforeunload reactive update ──────────────────────

	$effect(() => {
		const filename = getFileName();
		const dirty = getIsDirty();

		if (filename) {
			document.title = dirty ? `${filename} \u2022 CalmStudio` : `${filename} - CalmStudio`;
		} else {
			document.title = dirty ? 'CalmStudio \u2022 Unsaved' : 'CalmStudio';
		}

		// Reactively set/clear onbeforeunload based on dirty state
		if (dirty) {
			window.onbeforeunload = (e: BeforeUnloadEvent) => {
				e.preventDefault();
				e.returnValue = '';
				return '';
			};
		} else {
			window.onbeforeunload = null;
		}
	});
</script>

<DnDProvider>
	<div class="app-shell">
		<!-- Top: Slim toolbar -->
		<Toolbar
			onopen={handleOpen}
			onsave={handleSave}
			onsaveas={handleSaveAs}
			onnew={handleNew}
			onvalidate={handleValidate}
			onexportcalm={handleExportCalm}
			onexportzip={handleExportZip}
			onexportsvg={handleExportSvg}
			onexportpng={handleExportPng}
			onexportcalmscript={handleExportCalmscript}
			onexportscalertoml={handleExportScalerToml}
			onloaddemo={handleLoadDemo}
			ontemplates={() => (showTemplatePicker = true)}
			filename={getFileName()}
			onrename={(name) => setFileName(name)}
			isDirty={getIsDirty()}
			showScalerTomlExport={showScalerTomlExport}
			flows={flows}
			activeFlowId={activeFlowId}
			onflowchange={setActiveFlowId}
		/>

		<!-- Error banner: below toolbar, above canvas panes -->
		{#if importError}
			<div class="error-banner" role="alert">
				<span class="error-message">{importError}</span>
				<button
					type="button"
					class="error-dismiss"
					onclick={() => (importError = null)}
					aria-label="Dismiss error"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		{/if}

		<!-- Extension pack info banner: shown when pack-prefixed node types are detected on import -->
		{#if extensionPackBanner}
			<div class="pack-banner" role="status">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<span class="pack-banner-message">Extension pack types detected. All packs are loaded and ready.</span>
				<button
					type="button"
					class="pack-banner-dismiss"
					onclick={() => (extensionPackBanner = false)}
					aria-label="Dismiss extension pack notice"
				>Dismiss</button>
			</div>
		{/if}

		<!-- Browser save: decorators came down as a separate file that won't auto-reload -->
		{#if decoratorDownloadNotice}
			<div class="pack-banner" role="status">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
				<span class="pack-banner-message">Decorators were saved as a separate <code>.decorators.json</code> download. The browser can't re-read it on open — use Export → .zip to keep your architecture and decorators together.</span>
				<button
					type="button"
					class="pack-banner-dismiss"
					onclick={() => (decoratorDownloadNotice = false)}
					aria-label="Dismiss decorator download notice"
				>Dismiss</button>
			</div>
		{/if}

		{#if c4SeriesHint}
			<div class="pack-banner" role="status">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<rect x="3" y="3" width="13" height="13" rx="2" />
					<path d="M8 21h10a2 2 0 0 0 2-2V9" />
				</svg>
				<span class="pack-banner-message">Detailed views available — double-click a layer node to drill into its linked document.</span>
				<button
					type="button"
					class="pack-banner-dismiss"
					onclick={() => (c4SeriesHint = false)}
					aria-label="Dismiss detailed-views hint"
				>Dismiss</button>
			</div>
		{/if}

		<!-- a11y: announce the navigated document when it changes -->
		<div class="sr-only" aria-live="polite">{c4LiveMessage}</div>

		<!-- Main content: three-column canvas + bottom code panel + validation drawer -->
		<PaneGroup direction="vertical" class="main-pane-group">
			<!-- Top: Three-column layout (palette | canvas | properties) -->
			<Pane defaultSize={60} minSize={30}>
				<div class="canvas-row">
				<PaneGroup direction="horizontal" style="height: 100%;">
					<!-- Left: Node Palette (hidden in C4 mode) -->
					{#if !isC4Mode()}
						<Pane defaultSize={15} minSize={8}>
							<NodePalette onplacenode={handlePalettePlace} />
						</Pane>

						<PaneResizer class="resizer resizer-vertical" />
					{/if}

					<!-- Center: Canvas area -->
					<Pane defaultSize={70}>
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<div
							class="canvas-pane"
							class:c4-context={getC4Level() === 'context'}
							class:c4-container={getC4Level() === 'container'}
							class:c4-component={getC4Level() === 'component'}
							class:has-arch-decorator={hasArchDecorator}
							role="main"
							onkeydown={handleCanvasKeydown}
						>
							<!-- C4 Breadcrumb navigation bar (visible only in C4 mode) -->
							{#if isC4Mode()}
								<C4Breadcrumb
									level={getC4Level()!}
									rootLabel={getC4Trail()[0]?.label ?? 'Context'}
									drillStack={getC4Trail()
										.slice(1)
										.map((f, i) => ({ nodeId: String(i), label: f.label }))}
									onnavigate={handleBreadcrumbNavigate}
									levelBadge={getC4Level()!.charAt(0).toUpperCase() + getC4Level()!.slice(1)}
									oneditdocument={getActiveDocumentRef() ? handleEditCurrentDoc : undefined}
								/>
							{/if}
							{#if c4NavNotice}
								<div class="c4-nav-notice" role="alert">{c4NavNotice}</div>
							{/if}

							<!-- Floating toolbar (layout controls + dark mode toggle) -->
							<div class="canvas-toolbar">
								<!-- Auto-layout controls -->
								<div class="layout-group" role="group" aria-label="Auto-layout controls">
									<!-- Direction dropdown -->
									<select
										class="layout-select"
										bind:value={layoutDirection}
										aria-label="Layout direction"
										onchange={() => runLayout(layoutDirection)}
										title="Layout direction"
									>
										<option value="DOWN">Top to Bottom</option>
										<option value="RIGHT">Left to Right</option>
										<option value="UP">Hierarchical</option>
									</select>

									<!-- Layout button -->
									<button
										type="button"
										class="canvas-toolbar-btn"
										onclick={() => runLayout(layoutDirection)}
										aria-label="Auto-layout diagram"
										title="Auto-layout (ELK)"
									>
										<!-- Grid/arrange icon -->
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
											<rect x="3" y="3" width="7" height="7" rx="1" />
											<rect x="14" y="3" width="7" height="7" rx="1" />
											<rect x="3" y="14" width="7" height="7" rx="1" />
											<rect x="14" y="14" width="7" height="7" rx="1" />
										</svg>
									</button>
								</div>

								<!-- Dark mode toggle -->
								<button
									onclick={toggleTheme}
									class="canvas-toolbar-btn"
									aria-label={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
									title={isDark() ? 'Switch to light mode' : 'Switch to dark mode'}
								>
									{#if isDark()}
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
											<circle cx="12" cy="12" r="4" />
											<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
										</svg>
									{:else}
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
											<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
										</svg>
									{/if}
								</button>
							</div>

							<SvelteFlowProvider>
								{#if isC4Mode() && c4DocLoading}
									<!-- Loading a navigated document -->
									<div class="c4-empty-state">
										<p>Loading…</p>
									</div>
								{:else if isC4Mode() && c4DisplayNodes.length === 0}
									<!-- Genuinely empty document (no node-type dead-ends in the unified model) -->
									<div class="c4-empty-state">
										<p>This document has no nodes to display.</p>
									</div>
								{:else if isC4Mode()}
									<!-- C4 mode: pass derived display arrays (cannot bind: to derived) -->
									<CalmCanvas
										bind:this={canvas}
										nodes={c4DisplayNodes}
										edges={c4DisplayEdges}
										readonly={true}
										ondblclicknode={handleC4Drill}
										onselectionchange={handleSelectionChange}
									/>
								{:else}
									<!-- Normal mode: bind nodes/edges for two-way sync -->
									<CalmCanvas
										bind:this={canvas}
										bind:nodes
										bind:edges
										onplacenode={handlePalettePlace}
										onselectionchange={handleSelectionChange}
										ondblclicknode={handleNodeDoubleClick}
										onfileimport={importCalmFile}
										oncanvaschange={markDirty}
									/>
								{/if}

								<!-- Empty canvas start-from-template prompt -->
								{#if !isC4Mode() && nodes.length === 0}
									<div class="empty-canvas-hint">
										<p class="empty-hint-text">Drop a node from the palette or</p>
										<button
											type="button"
											class="start-template-link"
											onclick={() => (showTemplatePicker = true)}
										>
											Start from a template
										</button>
									</div>
								{/if}
							</SvelteFlowProvider>
						</div>
					</Pane>

					<PaneResizer class="resizer resizer-vertical" />

					<!-- Right: Properties panel (foldable; auto-fits the active tab) -->
					<Pane
						bind:this={inspectorPane}
						defaultSize={16}
						minSize={15}
						collapsible
						collapsedSize={0}
						onCollapse={() => (inspectorCollapsed = true)}
						onExpand={() => (inspectorCollapsed = false)}
						onResize={handleInspectorResize}
					>
						<PropertiesPanel
							{selectedNode}
							{selectedEdge}
							documentArchitecture={shownArchitecture}
							onBeforeFirstEdit={handleBeforeFirstEdit}
							onmutate={handlePropertyMutation}
							ontogglepin={handleTogglePin}
							readonly={isC4Mode()}
							onactivetab={(t) => (activeInspectorTab = t)}
							oncollapse={() => inspectorPane?.collapse()}
						/>
					</Pane>
				</PaneGroup>

				{#if inspectorCollapsed}
					<button
						class="inspector-handle reopen"
						onclick={() => inspectorPane?.expand()}
						aria-label="Open properties panel"
						title="Open panel"
					>‹</button>
				{/if}
			</div>
			</Pane>

			<PaneResizer class="resizer resizer-horizontal" />

			<!-- Middle: Code editor — main CALM document, plus the decorators document
			     side-by-side when the open document has any (read-only viewer). -->
			<Pane defaultSize={25} minSize={10}>
				<PaneGroup direction="horizontal" style="height: 100%;">
					<Pane defaultSize={hasDecoratorsDoc ? 62 : 100} minSize={30}>
						<CodePanel
							value={mainDocJson}
							onchange={handleCodeChange}
							parseError={codeParseError}
							selectedNodeId={selectedNodeId}
							selectedEdgeId={selectedEdgeId}
						/>
					</Pane>
					{#if hasDecoratorsDoc}
						<PaneResizer class="resizer resizer-vertical" />
						<Pane defaultSize={38} minSize={20}>
							<CodePanel value={decoratorsDocJson} readonly tabLabel="Decorators (sidecar)" />
						</Pane>
					{/if}
				</PaneGroup>
			</Pane>

			{#if isPanelOpen()}
				<PaneResizer class="resizer resizer-horizontal" />

				<!-- Bottom: Validation panel (shown after user clicks Validate) -->
				<Pane
					defaultSize={20}
					minSize={8}
				>
					<ValidationPanel
						issues={getIssues()}
						onnavigatetonode={handleNavigateToNode}
						ondismiss={() => { closePanel(); }}
						scrollToId={getScrollToElementId()}
					/>
				</Pane>
			{/if}
		</PaneGroup>

		<!-- Template picker modal — rendered at app-shell level so it covers everything -->
		{#if showTemplatePicker}
			<TemplatePicker
				onselect={handleTemplateLoad}
				oncancel={() => (showTemplatePicker = false)}
			/>
		{/if}

		<!-- Bottom: Status bar -->
		<footer class="status-bar">
			<span class="beta-badge">BETA</span>
			<span class="status-text">CalmStudio is open source under Apache 2.0</span>
			<a
				class="report-link"
				href="https://github.com/opsflo/calmstudio/issues"
				target="_blank"
				rel="noopener noreferrer"
			>Report an issue</a>
		</footer>
	</div>
</DnDProvider>

<style>
	/* Full-height app shell — toolbar + pane group stack vertically */
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	/* ─── Status bar ────────────────────────────────────────────── */

	.status-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 22px;
		padding: 0 10px;
		background: var(--color-surface-secondary, #f8fafc);
		border-top: 1px solid var(--color-border, #e2e8f0);
		font-size: 10px;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-tertiary, #94a3b8);
		flex-shrink: 0;
	}

	:global(.dark) .status-bar {
		background: #0b0f1a;
		border-color: #1e293b;
		color: #475569;
	}

	.beta-badge {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 1px 5px;
		border-radius: 3px;
		background: #f59e0b;
		color: #fff;
	}

	.status-text {
		flex: 1;
	}

	.report-link {
		color: var(--color-accent, #6366f1);
		text-decoration: none;
		font-weight: 500;
	}

	.report-link:hover {
		text-decoration: underline;
	}

	:global(.dark) .report-link {
		color: #818cf8;
	}

	/* PaneGroup fills remaining height below toolbar (and error banner) */
	:global(.main-pane-group) {
		flex: 1;
		min-height: 0;
	}

	/* Canvas pane fills its container with relative positioning for toolbar overlay */
	.canvas-pane {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--color-canvas-bg);
	}

	:global(.dark) .canvas-pane {
		background: #0b0f1a;
	}

	/* ─── Architecture-level decorator frame ────────────────────── */

	/* A thin inset frame signifies a decorator bound to the whole document.
	   Rendered as an overlay so it floats above the canvas without affecting
	   layout or intercepting pointer events. */
	.canvas-pane.has-arch-decorator::after {
		content: '';
		position: absolute;
		inset: 6px;
		border: 1.5px solid rgba(99, 102, 241, 0.55);
		border-radius: 10px;
		pointer-events: none;
		z-index: 6;
	}

	.canvas-pane.has-arch-decorator::before {
		content: '◆ architecture decorator';
		position: absolute;
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 7;
		padding: 2px 9px;
		font-family: var(--node-font, system-ui, sans-serif);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: #6366f1;
		background: var(--color-surface, #fff);
		border: 1px solid rgba(99, 102, 241, 0.4);
		border-radius: 999px;
		pointer-events: none;
	}

	:global(.dark) .canvas-pane.has-arch-decorator::before {
		background: #111827;
	}

	/* ─── C4 level background tints ─────────────────────────────── */

	.canvas-pane.c4-context {
		background-color: #fafafa;
	}

	.canvas-pane.c4-container {
		background-color: #f8faff;
	}

	.canvas-pane.c4-component {
		background-color: #f8fff8;
	}

	:global(.dark) .canvas-pane.c4-context {
		background-color: #1a1a1a;
	}

	:global(.dark) .canvas-pane.c4-container {
		background-color: #1a1a2a;
	}

	:global(.dark) .canvas-pane.c4-component {
		background-color: #1a2a1a;
	}

	/* ─── C4 empty state ─────────────────────────────────────────── */

	.c4-nav-notice {
		position: absolute;
		top: 36px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		padding: 6px 12px;
		font-size: 12px;
		border-radius: 6px;
		background: #fef3c7;
		color: #92400e;
		border: 1px solid #fcd34d;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	:global(.dark) .c4-nav-notice {
		background: #422006;
		color: #fde68a;
		border-color: #854d0e;
	}

	/* Nodes that link to a detailed document get a drill affordance (a "nested
	   document" corner glyph = there's another document behind this node). */
	:global(.svelte-flow__node.c4-drillable) {
		cursor: zoom-in;
	}
	:global(.svelte-flow__node.c4-drillable::after) {
		content: '';
		position: absolute;
		top: 4px;
		right: 4px;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		background-color: #6366f1;
		/* two offset rounded squares — a document nested behind the node */
		-webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.4' stroke-linejoin='round'><rect x='8' y='3' width='13' height='13' rx='2'/><path d='M16 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2'/></svg>") center / 12px no-repeat;
		mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.4' stroke-linejoin='round'><rect x='8' y='3' width='13' height='13' rx='2'/><path d='M16 19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2'/></svg>") center / 12px no-repeat;
		opacity: 0.85;
		pointer-events: none;
	}
	:global(.svelte-flow__node.c4-drillable:hover) {
		outline: 2px solid rgba(99, 102, 241, 0.5);
		outline-offset: 1px;
		border-radius: 6px;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(*) {
			transition-duration: 0.01ms !important;
			animation-duration: 0.01ms !important;
		}
	}

	.c4-empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #6b7280;
		font-size: 15px;
		gap: 4px;
	}

	:global(.dark) .c4-empty-state {
		color: #9ca3af;
	}

	/* ─── C4 node visual states ──────────────────────────────────── */

	:global(.c4-external .svelte-flow__node) {
		opacity: 0.5;
		filter: grayscale(0.5);
	}

	:global(.c4-peer) {
		opacity: 0.3;
		pointer-events: none;
	}

	/* [External] badge positioned above external nodes */
	:global(.c4-external::after) {
		content: '[External]';
		position: absolute;
		top: -16px;
		right: 4px;
		font-size: 9px;
		color: #888;
		background: #f0f0f0;
		padding: 0 4px;
		border-radius: 3px;
		z-index: 1;
	}

	:global(.dark) :global(.c4-external::after) {
		background: #333;
		color: #999;
	}

	/* ─── Error banner (full-width, below top Toolbar) ──────────── */

	.error-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		background: #fef2f2;
		border-bottom: 1px solid #fca5a5;
		padding: 8px 16px;
		font-size: 12px;
		font-family: var(--font-sans);
		color: #dc2626;
		flex-shrink: 0;
	}

	:global(.dark) .error-banner {
		background: #1c0a0a;
		border-color: #7f1d1d;
		color: #f87171;
	}

	.error-message {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.error-dismiss {
		background: none;
		border: none;
		cursor: pointer;
		color: inherit;
		display: flex;
		align-items: center;
		padding: 2px;
		border-radius: 4px;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.error-dismiss:hover {
		opacity: 1;
		background: rgba(220, 38, 38, 0.1);
	}

	/* ─── Extension pack info banner ────────────────────────────── */

	.pack-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		background: #eff6ff;
		border-bottom: 1px solid #bfdbfe;
		padding: 6px 16px;
		font-size: 12px;
		font-family: var(--font-sans);
		color: #1d4ed8;
		flex-shrink: 0;
	}

	:global(.dark) .pack-banner {
		background: #0c1a33;
		border-color: #1e3a5f;
		color: #60a5fa;
	}

	.pack-banner-message {
		flex: 1;
	}

	.pack-banner-dismiss {
		background: none;
		border: 1px solid currentColor;
		cursor: pointer;
		color: inherit;
		font-size: 11px;
		font-family: var(--font-sans);
		padding: 2px 8px;
		border-radius: 4px;
		opacity: 0.7;
		flex-shrink: 0;
	}

	.pack-banner-dismiss:hover {
		opacity: 1;
		background: rgba(29, 78, 216, 0.08);
	}

	/* ─── Floating canvas toolbar (layout + dark mode) ──────────── */

	.canvas-toolbar {
		position: absolute;
		right: 12px;
		top: 12px;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.canvas-toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 9px;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
		transition: all 0.15s ease;
	}

	.canvas-toolbar-btn:hover {
		background: var(--color-surface-tertiary);
		color: var(--color-text-primary);
	}

	:global(.dark) .canvas-toolbar-btn {
		background: #111827;
		border-color: #334155;
		color: #94a3b8;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	:global(.dark) .canvas-toolbar-btn:hover {
		background: #1e293b;
		color: #e2e8f0;
	}

	/* PaneResizer styling — thin draggable bars */
	/* Canvas + inspector row — positioning context for the reopen handle. */
	.canvas-row {
		position: relative;
		height: 100%;
	}
	/* Reopen tab on the right edge when the inspector is folded shut. */
	.inspector-handle.reopen {
		position: absolute;
		top: 50%;
		right: 0;
		transform: translateY(-50%);
		z-index: 30;
		width: 18px;
		height: 56px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		font-size: 14px;
		line-height: 1;
		background: var(--color-surface, #fff);
		color: var(--color-text-secondary, #64748b);
		border: 1px solid var(--color-border, #e2e8f0);
		border-right: none;
		border-radius: 6px 0 0 6px;
		cursor: pointer;
		box-shadow: -2px 0 8px rgba(0, 0, 0, 0.06);
	}
	.inspector-handle.reopen:hover {
		color: var(--color-accent, #6366f1);
		border-color: var(--color-accent, #6366f1);
	}
	:global(.dark) .inspector-handle.reopen {
		background: #0f1320;
		border-color: #334155;
		color: #94a3b8;
	}

	:global(.resizer) {
		background: transparent;
		transition: background 0.15s ease;
		flex-shrink: 0;
		position: relative;
		z-index: 10;
	}

	/* Vertical resizer (between horizontal panes) */
	:global(.resizer-vertical) {
		width: 4px;
		cursor: col-resize;
	}

	/* Horizontal resizer (between vertical panes) */
	:global(.resizer-horizontal) {
		height: 4px;
		cursor: row-resize;
	}

	:global(.resizer:hover) {
		background: var(--color-border);
		opacity: 0.6;
	}

	:global(.resizer[data-resize-handle-active]) {
		background: var(--color-accent, #3b82f6);
		opacity: 1;
	}

	:global(.dark) :global(.resizer:hover) {
		background: #334155;
		opacity: 0.8;
	}

	:global(.dark) :global(.resizer[data-resize-handle-active]) {
		background: #3b82f6;
		opacity: 1;
	}

	/* ─── Layout group (dropdown + button) ──────────────────────── */

	.layout-group {
		display: flex;
		align-items: center;
		gap: 2px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 9px;
		padding: 2px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
	}

	:global(.dark) .layout-group {
		background: #111827;
		border-color: #334155;
	}

	.layout-select {
		border: none;
		background: transparent;
		font-size: 11px;
		font-family: var(--font-sans);
		color: var(--color-text-secondary);
		cursor: pointer;
		padding: 4px 4px 4px 6px;
		border-radius: 7px;
		outline: none;
		min-width: 100px;
	}

	.layout-select:hover,
	.layout-select:focus {
		background: var(--color-surface-tertiary);
		color: var(--color-text-primary);
	}

	:global(.dark) .layout-select {
		color: #94a3b8;
	}

	:global(.dark) .layout-select option {
		background: #111827;
		color: #e2e8f0;
	}

	/* Layout button inside layout-group has no outer border/bg */
	.layout-group .canvas-toolbar-btn {
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		box-shadow: none;
		border-radius: 6px;
	}

	.layout-group .canvas-toolbar-btn:hover {
		background: var(--color-surface-tertiary);
	}

	:global(.dark) .layout-group .canvas-toolbar-btn {
		background: transparent;
	}

	:global(.dark) .layout-group .canvas-toolbar-btn:hover {
		background: #1e293b;
	}

	/* ─── Empty canvas "Start from template" prompt ──────────────── */

	.empty-canvas-hint {
		position: absolute;
		bottom: 48px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 6px;
		z-index: 10;
		pointer-events: none;
	}

	.empty-hint-text {
		font-size: 12px;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-secondary, #64748b);
		margin: 0;
		white-space: nowrap;
	}

	:global(.dark) .empty-hint-text {
		color: #475569;
	}

	.start-template-link {
		font-size: 12px;
		font-family: var(--font-sans, system-ui, sans-serif);
		font-weight: 500;
		color: var(--color-accent, #f97316);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		pointer-events: all;
	}

	.start-template-link:hover {
		color: #ea580c;
	}

	:global(.dark) .start-template-link {
		color: #fb923c;
	}

	:global(.dark) .start-template-link:hover {
		color: #f97316;
	}
</style>
