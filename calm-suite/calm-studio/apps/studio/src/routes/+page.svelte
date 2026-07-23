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
	import LeftSidebar from '$lib/explorer/LeftSidebar.svelte';
	import CalmCanvas from '$lib/canvas/CalmCanvas.svelte';
	import CodePanel from '$lib/editor/CodePanel.svelte';
	import PropertiesPanel from '$lib/properties/PropertiesPanel.svelte';
	import Toolbar from '$lib/toolbar/Toolbar.svelte';
	import ValidationPanel from '$lib/validation/ValidationPanel.svelte';
	import C4Breadcrumb from '$lib/c4/C4Breadcrumb.svelte';
	import {
		isC4Mode,
		getC4Level,
		getC4DrillStack,
		getCurrentDrillParentId,
		enterC4Mode,
		exitC4Mode,
		setC4Level,
		drillDown,
		drillUpTo,
	} from '$lib/c4/c4State.svelte';
	import {
		filterNodesForLevel,
		filterEdgesForVisibleNodes,
		liftEdgesForLevel,
		applyC4Styles,
		hasDrillableChildren,
		classifyNodeC4Level,
	} from '$lib/c4/c4Filter';
	import type { C4Level } from '$lib/c4/c4Filter';
	import { toggleTheme, isDark } from '$lib/stores/theme.svelte';
	import { getModelJson, getExportJson, applyFromJson, applyFromCanvas, getModel, resetModel, updateEdgeProperty } from '$lib/stores/calmModel.svelte';
	import { calmToFlow } from '$lib/stores/projection';
	import { applyContainmentFromEdges } from '$lib/canvas/containment';
	import { pushSnapshot, resetHistory, undo, redo, exportHistoryState, loadHistoryState, createEmptyHistoryState } from '$lib/stores/history.svelte';
	import { layoutCalm, type LayoutDirection } from '$lib/layout/elkLayout';
	import { buildLayoutSizeHints } from '$lib/layout/layoutSizeHints';
	import { openFile, saveFile, saveFileAs } from '$lib/io/fileSystem';
	import {
		getFileName,
		getFileHandle,
		getFileRelativePath,
		hasUnsavedChanges,
		markDirty,
		markClean,
		resetFileState,
		setCleanSnapshot,
	} from '$lib/io/fileState.svelte';
	import UnsavedChangesDialog from '$lib/io/UnsavedChangesDialog.svelte';
	import DiagramTabBar from '$lib/tabs/DiagramTabBar.svelte';
	import type { DiagramTabState } from '$lib/tabs/tabManager';
	import {
		MAX_DIAGRAM_TABS,
		closeTab,
		findTabByFile,
		openOrActivateTab,
		patchTabState,
		pickFifoEvictionCandidate,
	} from '$lib/tabs/tabManager';
	import { swapRelationshipDirection } from '$lib/stores/relationshipSwap';
	import { resolveDetailedArchitecture } from '$lib/reference/resolveReference';
	import OutsideProjectInfobox from '$lib/reference/OutsideProjectInfobox.svelte';
	import { findFileInTree, readFileContent } from '$lib/explorer/folderScan';
	import { getExplorerTree } from '$lib/explorer/explorerTree.svelte';
	import { isTauri } from '$lib/desktop/isTauri';
	import { updateWindowTitle } from '$lib/desktop/titleBar';
	import { buildAppMenu, updateRecentFilesMenu } from '$lib/desktop/menu';
	import { addRecentFile, getRecentFiles } from '$lib/desktop/recentFiles';
	import { startMcpSidecar, stopMcpSidecar } from '$lib/desktop/sidecarMcp';
	import { registerFileDrop } from '$lib/desktop/dragDrop';
	import { checkForUpdates } from '$lib/desktop/updater';
	import { registerFileOpenHandler } from '$lib/desktop/fileOpen';
	import { readTextFile } from '@tauri-apps/plugin-fs';
	import { exportAsCalm, exportAsSvg, exportAsPng, exportAsCalmscript, exportAsScalerToml } from '$lib/io/export';
	import type { CalmArchitecture, CalmRelationship } from '@calmstudio/calm-core';
	import { getReferencedNodeIds } from '@calmstudio/calm-core';
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
		runValidationAsync,
	} from '$lib/stores/validation.svelte';
	import {
		refreshGovernance,
		updateSelectedNodeGovernance,
		getArchitectureScore,
		hasAINodes,
	} from '$lib/stores/governance.svelte';
	import {
		getActiveFlowId,
		setActiveFlowId,
		getActiveFlowEdgeIds,
		getFlowTransitionForEdge,
		isNodeInActiveFlow,
	} from '$lib/stores/flowState.svelte';
	import { applyExtractToParent } from '$lib/project/extractSubgraph';
	import { resolveExtractPath } from '$lib/project/naming';
	import {
		ensureWritePermission,
		projectRelativeFileExists,
		writeProjectRelativeFile,
	} from '$lib/project/projectFs';
	import { getProjectConfig, getProjectRootHandle } from '$lib/project/projectStore.svelte';
	import { relativePathBetween } from '$lib/explorer/relativePath';
	import ExtractToDiagramDialog from '$lib/project/ExtractToDiagramDialog.svelte';
	import { isReferenceNode } from '$lib/metadata/referenceNode';
	import { asCalmFlowNodeData } from '$lib/canvas/flowTypes';

	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);

	let diagramTabs = $state<DiagramTabState[]>([]);
	let activeTabId = $state<string | null>(null);
	/** Bumped on tab restore to force Svelte Flow remount with fresh nodes/edges. */
	let tabRenderKey = $state(0);
	let outsideProjectHref = $state<string | null>(null);

	let canvas: CalmCanvas;
	let leftSidebar: LeftSidebar | undefined = $state();
	let referenceFocusWarning = $state<string | null>(null);

	// ─── Extract to diagram (R27) ─────────────────────────────────────────────
	let extractDialog = $state<{
		nodeId: string;
		folder: string;
		fileName: string;
		warning: string | null;
	} | null>(null);
	let extractError = $state<string | null>(null);

	// ─── Desktop: native title bar sync ───────────────────────────────────────

	// Reactively update the native OS window title when filename or dirty state changes.
	// Only active in Tauri desktop mode — no-ops in browser builds.
	$effect(() => {
		if (isTauri()) {
			updateWindowTitle(getFileName(), isDocumentModified);
		}
	});

	// ─── C4 View Mode ─────────────────────────────────────────────────────────

	/** Saved viewport before entering C4 mode — restored on exit. */
	let savedViewport: Viewport | null = null;

	/** Position overrides for C4 views — computed by running ELK on the filtered subset. */
	let c4PositionOverrides = $state.raw<Map<string, { x: number; y: number; width?: number; height?: number }>>(new Map());

	/**
	 * Derived C4 display nodes. When C4 mode is active, filters and styles nodes
	 * for the current level and drill position. Returns raw nodes when not in C4 mode.
	 */
	const c4DisplayNodes = $derived.by(() => {
		if (!isC4Mode()) return nodes;
		const level = getC4Level()!;
		const drillParentId = getCurrentDrillParentId();
		let filtered = filterNodesForLevel(nodes, level, drillParentId);
		// Add faded peer nodes when drilled into a container
		if (drillParentId) {
			const parentNode = nodes.find((n) => n.id === drillParentId);
			if (parentNode?.parentId) {
				// Peers = siblings of the parent (same grandparent), minus the drilled parent
				const peers = nodes.filter(
					(n) => n.parentId === parentNode.parentId && n.id !== drillParentId
				);
				const fadedPeers = peers.map((n) => ({ ...n, data: { ...n.data, c4Peer: true } }));
				filtered = [...filtered, ...fadedPeers];
			} else {
				// Parent is top-level — peers are other top-level nodes of same level
				const peers = nodes.filter(
					(n) =>
						!n.parentId &&
						n.id !== drillParentId &&
						classifyNodeC4Level(String(n.data?.calmType ?? '')) === level
				);
				// Limit to a few peers for context
				const fadedPeers = peers
					.slice(0, 5)
					.map((n) => ({ ...n, data: { ...n.data, c4Peer: true } }));
				filtered = [...filtered, ...fadedPeers];
			}
		}
		let styled = applyC4Styles(filtered, level);

		// Apply compact C4 layout positions if available
		if (c4PositionOverrides.size > 0) {
			styled = styled.map((n) => {
				const pos = c4PositionOverrides.get(n.id);
				if (!pos) return n;
				return {
					...n,
					position: { x: pos.x, y: pos.y },
					...(pos.width !== undefined ? { width: pos.width, height: pos.height } : {}),
				};
			});
		}

		return styled;
	});

	/**
	 * Derived C4 display edges. When C4 mode is active, lifts edges to the
	 * current abstraction level — hidden intermediary endpoints are mapped
	 * to their nearest visible container ancestor via edge lifting.
	 */
	const c4DisplayEdges = $derived.by(() => {
		if (!isC4Mode()) return edges;
		const nonPeerIds = new Set(
			c4DisplayNodes.filter((n) => !n.data?.c4Peer).map((n) => n.id)
		);
		return liftEdgesForLevel(edges, nodes, nonPeerIds);
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
		void (async () => {
			await runValidationAsync();
			enrichNodesEdgesWithValidation();
		})();
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
	async function layoutC4View() {
		const level = getC4Level();
		const drillParentId = getCurrentDrillParentId();
		if (!level) return;

		// Wait for derived nodes to settle
		await tick();

		// Get the IDs of visible (non-peer) nodes
		const visibleIds = new Set(
			c4DisplayNodes
				.filter((n) => !n.data?.c4Peer)
				.map((n) => n.id)
		);

		// Build a sub-CALM architecture with just the visible nodes
		const model = getModel();
		const subArch: CalmArchitecture = {
			nodes: model.nodes.filter((n) => visibleIds.has(n['unique-id'])),
			relationships: model.relationships.filter((r) =>
				getReferencedNodeIds(r).every((id) => visibleIds.has(id))
			),
		};

		if (subArch.nodes.length === 0) return;

		const positions = await layoutCalm(
			subArch,
			new Set(),
			layoutDirection,
			buildLayoutSizeHints(subArch, nodes)
		);
		c4PositionOverrides = positions;

		await tick();
		canvas?.fitViewport();
	}

	// ─── C4 level change handler ─────────────────────────────────────────────

	function handleC4LevelChange(level: string | null) {
		if (level === null) {
			// Exit C4 mode — restore viewport, clear layout overrides
			exitC4Mode();
			c4PositionOverrides = new Map();
			tick().then(() => {
				if (savedViewport) {
					canvas?.restoreViewport?.(savedViewport);
					savedViewport = null;
				}
			});
		} else {
			if (!isC4Mode()) {
				// Entering C4 mode — save viewport
				savedViewport = canvas?.saveViewport?.() ?? null;
			}
			if (isC4Mode()) {
				setC4Level(level as C4Level);
			} else {
				enterC4Mode(level as C4Level);
			}
			layoutC4View();
		}
	}

	// ─── Drill-down handler ───────────────────────────────────────────────────

	function handleC4DrillDown(node: Node) {
		if (!isC4Mode()) return;
		// Skip peer nodes (they are faded context-only nodes, not drillable)
		if (node.data?.c4Peer) return;
		if (!hasDrillableChildren(node.id, nodes)) return;
		const label = String(node.data?.label ?? node.data?.calmId ?? node.id);
		drillDown(node.id, label);
		layoutC4View();
	}

	// ─── Breadcrumb navigate handler ─────────────────────────────────────────

	function handleBreadcrumbNavigate(index: number) {
		drillUpTo(index);
		layoutC4View();
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

	// ─── Template picker state ────────────────────────────────────────────────

	/** When true, the full-screen TemplatePicker modal is shown. */
	let showTemplatePicker = $state(false);

	// ─── Unsaved changes dialog (Save / Don't save / Cancel) ─────────────────

	type UnsavedChoice = 'save' | 'discard' | 'cancel';

	let showUnsavedDialog = $state(false);
	let unsavedDialogResolver: ((choice: UnsavedChoice) => void) | null = null;

	function promptUnsavedChanges(): Promise<UnsavedChoice> {
		return new Promise((resolve) => {
			unsavedDialogResolver = resolve;
			showUnsavedDialog = true;
		});
	}

	function resolveUnsavedDialog(choice: UnsavedChoice) {
		showUnsavedDialog = false;
		unsavedDialogResolver?.(choice);
		unsavedDialogResolver = null;
	}

	function markDocumentClean(
		name?: string,
		handle?: FileSystemFileHandle | string | null,
		relativePath?: string | null
	) {
		markClean(name, handle, relativePath);
		setCleanSnapshot(getModelJson());
	}

	async function ensureCanProceedWithUnsavedChanges(): Promise<boolean> {
		if (!hasUnsavedChanges(getModelJson())) return true;

		const choice = await promptUnsavedChanges();
		if (choice === 'cancel') return false;
		if (choice === 'save') {
			await handleSave();
			if (hasUnsavedChanges(getModelJson())) return false;
		}
		return true;
	}

	// ─── Diagram tabs (P1 R15) ───────────────────────────────────────────────

	function isTabDirty(tab: DiagramTabState): boolean {
		if (tab.id === activeTabId) {
			return hasUnsavedChanges(getModelJson());
		}
		return tab.modelJson !== tab.cleanSnapshot;
	}

	function cloneFlowState<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	function buildFlowPositionMap(
		tabNodes: Node[],
		arch?: CalmArchitecture
	): Map<string, { x: number; y: number; width?: number; height?: number }> {
		const allowedIds = arch ? new Set(arch.nodes.map((n) => n['unique-id'])) : null;
		const positionMap = new Map<string, { x: number; y: number; width?: number; height?: number }>();
		for (const n of tabNodes) {
			const calmId = n.data?.calmId as string | undefined;
			if (!calmId || (allowedIds && !allowedIds.has(calmId))) continue;
			positionMap.set(calmId, {
				...n.position,
				width: n.measured?.width ?? n.width,
				height: n.measured?.height ?? n.height,
			});
		}
		return positionMap;
	}

	/** Clear nested Svelte Flow nodes before replacing the diagram (avoids ghost containers). */
	async function flushCanvasBeforeReplace(): Promise<void> {
		selectedNodeId = null;
		selectedEdgeId = null;
		nodes = [];
		edges = [];
		tabRenderKey += 1;
		await tick();
	}

	function applyArchitectureToCanvas(
		arch: CalmArchitecture,
		positionMap: Map<string, { x: number; y: number; width?: number; height?: number }>
	): void {
		const projected = calmToFlow(arch, positionMap);
		edges = projected.edges;
		nodes = applyContainmentFromEdges(projected.nodes, projected.edges);
		applyFromCanvas(nodes, edges);
	}

	function persistActiveTab(): void {
		if (!activeTabId) return;
		applyFromCanvas(nodes, edges);
		const json = getModelJson();
		diagramTabs = patchTabState(diagramTabs, activeTabId, {
			nodes: cloneFlowState(nodes),
			edges: cloneFlowState(edges),
			history: exportHistoryState(),
			modelJson: json,
			selectedNodeId,
			selectedEdgeId,
		});
	}

	async function restoreTabState(tab: DiagramTabState): Promise<void> {
		importError = null;
		extensionPackBanner = false;
		clearValidation();
		clearTimeout(codeChangeTimer);
		codeParseError = null;

		const arch = JSON.parse(tab.modelJson) as CalmArchitecture;
		loadHistoryState(tab.history);
		applyFromJson(arch);

		// Flush first — Svelte Flow keeps parent/container nodes unless the canvas is cleared.
		await flushCanvasBeforeReplace();
		// Restore canvas snapshot (edges may be ahead of modelJson if sync was missed).
		nodes = applyContainmentFromEdges(cloneFlowState(tab.nodes), cloneFlowState(tab.edges));
		edges = cloneFlowState(tab.edges);
		applyFromCanvas(nodes, edges);

		markClean(tab.label, tab.fileHandle, tab.relativePath);
		setCleanSnapshot(tab.cleanSnapshot);
		selectedNodeId = tab.selectedNodeId;
		selectedEdgeId = tab.selectedEdgeId;
		refreshGovernance();

		await tick();
		canvas?.fitViewport();
	}

	async function evictOldestTabIfNeeded(): Promise<boolean> {
		if (diagramTabs.length < MAX_DIAGRAM_TABS) return true;
		const victim = pickFifoEvictionCandidate(
			diagramTabs.filter((t) => t.id !== activeTabId)
		);
		if (!victim) return true;
		if (isTabDirty(victim)) {
			const confirmed = window.confirm(
				`Zavřít nejstarší záložku „${victim.label}" s neuloženými změnami?`
			);
			if (!confirmed) return false;
		}
		diagramTabs = diagramTabs.filter((t) => t.id !== victim.id);
		if (activeTabId === victim.id) {
			activeTabId = diagramTabs[0]?.id ?? null;
			if (activeTabId) {
				const next = diagramTabs.find((t) => t.id === activeTabId);
				if (next) await restoreTabState(next);
			}
		}
		return true;
	}

	function registerCurrentDocumentAsTab(
		label: string,
		handle: FileSystemFileHandle | string | null,
		relativePath: string | null
	): void {
		const json = getModelJson();
		const tabId = crypto.randomUUID();
		const result = openOrActivateTab(diagramTabs, activeTabId, tabId, {
			label,
			fileHandle: handle,
			relativePath,
			nodes,
			edges,
			history: exportHistoryState(),
			modelJson: json,
			cleanSnapshot: json,
			selectedNodeId,
			selectedEdgeId,
		});
		diagramTabs = result.tabs;
		activeTabId = result.activeTabId;
	}

	async function handleActivateTab(tabId: string): Promise<void> {
		if (tabId === activeTabId) return;
		// Per R15: tab switch persists in-memory state without an unsaved-changes dialog.
		persistActiveTab();
		const tab = diagramTabs.find((t) => t.id === tabId);
		if (!tab) return;
		activeTabId = tabId;
		await restoreTabState(tab);
	}

	async function handleCloseTab(tabId: string): Promise<void> {
		const tab = diagramTabs.find((t) => t.id === tabId);
		if (!tab) return;

		if (tabId === activeTabId) {
			if (!(await ensureCanProceedWithUnsavedChanges())) return;
		} else if (isTabDirty(tab)) {
			const confirmed = window.confirm(
				`Zavřít záložku „${tab.label}" s neuloženými změnami?`
			);
			if (!confirmed) return;
		}

		const result = closeTab(diagramTabs, activeTabId, tabId);
		diagramTabs = result.tabs;
		activeTabId = result.activeTabId;

		if (activeTabId) {
			const next = diagramTabs.find((t) => t.id === activeTabId);
			if (next) await restoreTabState(next);
		} else {
			resetModel();
			resetHistory();
			resetFileState();
			nodes = [];
			edges = [];
			setCleanSnapshot(getModelJson());
		}
	}

	async function handleNewTab(): Promise<void> {
		if (!(await ensureCanProceedWithUnsavedChanges())) return;
		if (!(await evictOldestTabIfNeeded())) return;
		persistActiveTab();

		resetModel();
		resetHistory();
		resetFileState();
		clearValidation();
		nodes = [];
		edges = [];
		selectedNodeId = null;
		selectedEdgeId = null;
		const json = getModelJson();
		setCleanSnapshot(json);

		const tabId = crypto.randomUUID();
		const newTab: DiagramTabState = {
			id: tabId,
			label: 'Untitled',
			fileHandle: null,
			relativePath: null,
			openedAt: Date.now(),
			nodes: [],
			edges: [],
			history: createEmptyHistoryState(),
			modelJson: json,
			cleanSnapshot: json,
			selectedNodeId: null,
			selectedEdgeId: null,
		};
		diagramTabs = [...diagramTabs, newTab];
		activeTabId = tabId;
	}

	async function handleNavigateReference(calmId: string): Promise<void> {
		const node = nodes.find((n) => n.data?.calmId === calmId || n.id === calmId);
		if (!node) return;
		const details = node.data?.calmDetails as Record<string, string> | undefined;
		const href = details?.['detailed-architecture'];
		if (!href) return;

		// R22 — focus this unique-id in the target diagram after open
		const focusUniqueId = (node.data?.calmId as string) ?? calmId;

		const resolved = resolveDetailedArchitecture(getFileRelativePath(), href);
		if (resolved.kind === 'external') {
			outsideProjectHref = resolved.url;
			return;
		}
		if (resolved.kind === 'outside-project') {
			outsideProjectHref = resolved.href;
			return;
		}

		const file = findFileInTree(getExplorerTree(), resolved.relativePath);
		if (!file) {
			importError = `Referenced file not found in project: ${resolved.relativePath}`;
			return;
		}
		const content = await readFileContent(file);
		const opened = await openCalmFileAfterConfirm(content, file.name, file.handle, file.relativePath);
		if (!opened) return;

		await tick();
		const target = nodes.find(
			(n) => (n.data?.calmId as string) === focusUniqueId || n.id === focusUniqueId
		);
		if (target) {
			selectedNodeId = focusUniqueId;
			selectedEdgeId = null;
			canvas?.navigateToNode(focusUniqueId);
			referenceFocusWarning = null;
		} else {
			referenceFocusWarning = `Referenced node "${focusUniqueId}" was not found in the target diagram.`;
			setTimeout(() => {
				if (referenceFocusWarning?.includes(focusUniqueId)) referenceFocusWarning = null;
			}, 4000);
		}
	}

	function handleSwapSelectedEdge(): void {
		if (!selectedEdge) return;
		const variant = (selectedEdge.data?.calmVariant ??
			selectedEdge.type ??
			'connects') as import('@calmstudio/calm-core').CalmRelationshipVariant;
		const swapped = swapRelationshipDirection(
			variant,
			selectedEdge.source,
			selectedEdge.target
		);
		const relId = (selectedEdge.data?.calmRelId as string) ?? selectedEdge.id;
		updateEdgeProperty(relId, 'relationship-type', swapped.relationshipType);
		edges = edges.map((e) =>
			e.id === selectedEdge.id
				? { ...e, source: swapped.source, target: swapped.target }
				: e
		);
		nodes = applyContainmentFromEdges(nodes, edges);
		handlePropertyMutation();
		markDirty();
	}

	/**
	 * Load a template onto the canvas.
	 * If the canvas has content, prompts the user to confirm overwrite.
	 * Strips _template metadata via registry.loadTemplate(), then applies like a file import.
	 */
	async function handleTemplateLoad(templateId: string) {
		// Dirty-state guard — templates replace the whole canvas
		if (hasUnsavedChanges(getModelJson()) || nodes.length > 0) {
			const confirmed = window.confirm('You have unsaved changes. Load template anyway?');
			if (!confirmed) return;
		}

		showTemplatePicker = false;

		// loadTemplate returns clean CalmArchitecture without _template
		const arch = loadTemplate(templateId);

		// Apply as if it were a file import — reuse importCalmFile logic
		await importCalmFile(JSON.stringify(arch));

		// Template load doesn't bind to a file — mark clean but without filename
		markDocumentClean();

		// Initialize governance score for the loaded template
		refreshGovernance();
	}

	function handlePalettePlace(type: string) {
		canvas?.placeNodeAtCenter(type);
	}

	// ─── Forward sync: model -> JSON string for code panel ───────────────────

	// Re-derive JSON when the active tab changes so the code panel tracks tab switches.
	const calmJson = $derived.by(() => {
		activeTabId;
		// Track model mutations (canvas sync, property edits, code panel apply).
		getModel();
		return getModelJson();
	});
	const isDocumentModified = $derived(hasUnsavedChanges(calmJson));

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

	function handleSelectionChange(nodeId: string | null, edgeId: string | null) {
		selectedNodeId = nodeId;
		selectedEdgeId = edgeId;
	}

	// ─── Governance store wiring ──────────────────────────────────────────────

	/**
	 * Keep governance store updated when selection changes.
	 * Uses $effect to track selectedNode reactively.
	 */
	$effect(() => {
		const nodeType = selectedNode?.data?.calmType ? String(selectedNode.data.calmType) : null;
		const nodeId = selectedNode?.data?.calmId ? String(selectedNode.data.calmId) : null;
		updateSelectedNodeGovernance(nodeType, nodeId);
	});

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
		// Mark dirty immediately so open/save guards work before debounced parse.
		markDirty();
		// Debounce: wait 400ms after last change before parsing
		clearTimeout(codeChangeTimer);
		codeChangeTimer = setTimeout(() => {
			try {
				const parsed = JSON.parse(newValue) as CalmArchitecture;
				codeParseError = null;

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

					// dirty already set on keystroke; keep explicit for canvas-driven paths
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
	 * canvas and code panel in sync. Also refreshes governance score.
	 */
	function handlePropertyMutation() {
		refreshGovernance();
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
		// Preserve node selection state so SvelteFlow doesn't fire deselection
		let nextNodes = projected.nodes.map((n) =>
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

		// composed-of / deployed-in: enlarge container and fix child positions
		nextNodes = applyContainmentFromEdges(nextNodes, edges);
		nodes = nextNodes;

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
		markDirty();
	}

	/** R27 — open Extract dialog with naming defaults from .calmrj. */
	function handleExtractRequest(nodeId: string) {
		extractError = null;
		const root = getProjectRootHandle();
		if (!root) {
			extractError = 'Open a project folder before extracting to a diagram.';
			return;
		}
		const currentPath = getFileRelativePath();
		if (!currentPath) {
			extractError = 'Save the current diagram into the project folder first.';
			return;
		}
		applyFromCanvas(nodes, edges);
		const model = getModel();
		const node = model.nodes.find((n) => n['unique-id'] === nodeId);
		if (!node) return;
		const flowNode = nodes.find((n) => n.data?.calmId === nodeId);
		if (flowNode && isReferenceNode(asCalmFlowNodeData(flowNode.data as Record<string, unknown>))) {
			return;
		}
		const naming = resolveExtractPath(
			String(node['node-type']),
			{ name: node.name || nodeId },
			getProjectConfig(),
			currentPath
		);
		extractDialog = {
			nodeId,
			folder: naming.folder,
			fileName: naming.fileName,
			warning: naming.warning ?? null,
		};
	}

	async function handleExtractConfirm(result: { folder: string; fileName: string }) {
		if (!extractDialog) return;
		const nodeId = extractDialog.nodeId;
		extractDialog = null;
		extractError = null;

		const root = getProjectRootHandle();
		const currentPath = getFileRelativePath();
		if (!root || !currentPath) {
			extractError = 'Project folder or current file path is missing.';
			return;
		}

		const ok = await ensureWritePermission(root);
		if (!ok) {
			extractError = 'Write permission required to create the extracted diagram.';
			return;
		}

		const relativeChild = result.folder
			? `${result.folder.replace(/\/+$/, '')}/${result.fileName}`
			: result.fileName;

		if (await projectRelativeFileExists(root, relativeChild)) {
			const overwrite = confirm(`File already exists:\n${relativeChild}\n\nOverwrite?`);
			if (!overwrite) return;
		}

		try {
			applyFromCanvas(nodes, edges);
			pushSnapshot(nodes, edges);
			const model = getModel();
			const detailedHref = relativePathBetween(currentPath, relativeChild);
			const { parentArchitecture, childArchitecture } = applyExtractToParent(
				model,
				nodeId,
				detailedHref
			);

			const childJson = JSON.stringify(childArchitecture, null, 2) + '\n';
			const childHandle = await writeProjectRelativeFile(root, relativeChild, childJson);

			applyFromJson(parentArchitecture);
			const positionMap = new Map<string, { x: number; y: number; width?: number; height?: number }>();
			for (const n of nodes) {
				if (n.data?.calmId) {
					positionMap.set(n.data.calmId as string, {
						...n.position,
						width: n.measured?.width ?? n.width,
						height: n.measured?.height ?? n.height,
					});
				}
			}
			applyArchitectureToCanvas(parentArchitecture, positionMap);
			markDirty();
			await leftSidebar?.rescanTree();

			const childName = relativeChild.split('/').pop() ?? result.fileName;
			// Parent tab already holds the stub (dirty); skip unsaved prompt so Extract can open the child.
			await openCalmFileAfterConfirm(childJson, childName, childHandle, relativeChild, {
				skipUnsavedPrompt: true,
			});
		} catch (e) {
			extractError = (e as Error).message;
		}
	}

	// ─── CALM file import ─────────────────────────────────────────────────────

	/**
	 * Open a CALM file after optional unsaved-changes confirmation.
	 */
	async function openCalmFileAfterConfirm(
		content: string,
		name: string,
		handle: FileSystemFileHandle | string | null = null,
		relativePath: string | null = null,
		options?: { skipUnsavedPrompt?: boolean }
	): Promise<boolean> {
		const existing = findTabByFile(diagramTabs, relativePath, handle);
		if (existing) {
			await handleActivateTab(existing.id);
			return true;
		}

		if (!options?.skipUnsavedPrompt && !(await ensureCanProceedWithUnsavedChanges())) {
			return false;
		}
		if (!(await evictOldestTabIfNeeded())) {
			return false;
		}

		persistActiveTab();
		resetHistory();
		await importCalmFile(content, name);
		markDocumentClean(name, handle, relativePath);
		registerCurrentDocumentAsTab(name, handle, relativePath);
		// Canvas must sync after activeTabId is set (import alone updates JSON before the tab switch).
		const activeTab = diagramTabs.find((t) => t.id === activeTabId);
		if (activeTab) await restoreTabState(activeTab);
		return true;
	}

	/**
	 * Import a CALM JSON file from string content.
	 * Validates JSON and presence of `nodes` array.
	 * On success: applies to model, runs ELK layout, projects to canvas, fits view.
	 * On error: sets importError, canvas unchanged (no partial load).
	 */
	async function importCalmFile(content: string, _filename?: string) {
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

		// Apply to canonical model
		applyFromJson(parsed);

		// Auto-layout with no pinned nodes on fresh import
		const importHints = buildLayoutSizeHints(parsed);
		const positionMap = await layoutCalm(parsed, new Set(), 'DOWN', importHints);

		await flushCanvasBeforeReplace();
		applyArchitectureToCanvas(parsed, positionMap);

		// Fit view after DOM update
		await tick();
		canvas?.fitViewport();

		// Initialize governance score for the loaded architecture
		refreshGovernance();
	}

	// ─── File operations ──────────────────────────────────────────────────────

	async function handleOpenExplorerFile(
		content: string,
		name: string,
		relativePath: string,
		handle: FileSystemFileHandle
	) {
		await openCalmFileAfterConfirm(content, name, handle, relativePath);
	}

	async function handleOpen() {
		try {
			const result = await openFile();
			const opened = await openCalmFileAfterConfirm(
				result.content,
				result.name,
				result.handle,
				null
			);
			if (!opened) return;
			// Desktop: add to recent files and refresh menu
			if (isTauri() && typeof result.handle === 'string') {
				const recent = await addRecentFile(result.handle);
				await updateRecentFilesMenu(recent);
			}
		} catch (e) {
			// User cancelled the file picker — not an error
		}
	}

	async function handleFileImport(content: string, filename?: string) {
		const name = filename ?? 'imported.calm.json';
		await openCalmFileAfterConfirm(content, name, null, null);
	}

	async function handleLoadDemo(demo: { id: string; name: string; path: string }) {
		const response = await fetch(demo.path);
		const content = await response.text();
		await openCalmFileAfterConfirm(content, demo.name + '.calm.json', null, null);
	}

	async function refreshExplorerAfterSave(): Promise<void> {
		const relativePath = getFileRelativePath();
		if (!relativePath) return;
		await leftSidebar?.refreshSavedFile(relativePath);
	}

	async function handleSave() {
		try {
			const json = getExportJson(nodes, edges);
			syncCanvasToModel();
			const handle = await saveFile(json, getFileHandle(), getFileName() ?? 'architecture.calm.json');
			markDocumentClean(undefined, handle);
			await refreshExplorerAfterSave();
		} catch (e) {
			// User cancelled or save failed — remain dirty
		}
	}

	async function handleSaveAs() {
		try {
			const json = getExportJson(nodes, edges);
			syncCanvasToModel();
			const handle = await saveFileAs(json, getFileName() ?? 'architecture.calm.json');
			// saveFileAs returns:
			// - string path (Tauri desktop)
			// - FileSystemFileHandle (browser FSA)
			// - null (Blob download fallback or user cancel)
			if (typeof handle === 'string') {
				// Tauri desktop: extract filename from path
				const name = handle.split(/[\\/]/).pop() ?? getFileName() ?? undefined;
				markDocumentClean(name, handle);
			} else if (handle) {
				// Browser FSA: use handle.name
				markDocumentClean(handle.name ?? getFileName() ?? undefined, handle);
			} else {
				// Blob download — we can mark clean since content was "saved" (downloaded)
				markDocumentClean();
			}
			await refreshExplorerAfterSave();
		} catch (e) {
			// User cancelled or save failed — remain dirty
		}
	}

	async function handleNew() {
		await handleNewTab();
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
			const opened = await openCalmFileAfterConfirm(content, name, path, null);
			if (!opened) return;
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
					nodes = snapshot.nodes;
					edges = snapshot.edges;
					applyFromCanvas(nodes, edges);
				}
			},
			redo: () => {
				const snapshot = redo();
				if (snapshot) {
					nodes = snapshot.nodes;
					edges = snapshot.edges;
					applyFromCanvas(nodes, edges);
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

	/** Sync live canvas into the canonical model before save/tab persist. */
	function syncCanvasToModel(): void {
		applyFromCanvas(nodes, edges);
	}

	function handleExportCalm() {
		exportAsCalm(getExportJson(nodes, edges));
	}

	async function handleExportSvg() {
		await tick();
		if (nodes.length === 0) {
			window.alert('Export SVG: diagram has no nodes on canvas.');
			return;
		}
		await exportAsSvg(nodes, edges);
	}

	async function handleExportPng() {
		await tick();
		if (nodes.length === 0) {
			window.alert('Export PNG: diagram has no nodes on canvas.');
			return;
		}
		await exportAsPng(nodes, edges);
	}

	function handleExportCalmscript() {
		// Phase 4 stub: export CALM JSON with a header comment — Phase 5 will provide real calmscript
		const json = getExportJson(nodes, edges);
		exportAsCalmscript(`// calmscript export — full DSL support coming in Phase 5\n// CALM JSON representation:\n${json}\n`);
	}

	function handleExportScalerToml() {
		const arch = JSON.parse(getExportJson(nodes, edges)) as CalmArchitecture;
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

		// Size hints must match rendered label chrome — otherwise ELK packs too tight
		const sizeHints = buildLayoutSizeHints(model, nodes);

		// Run ELK for free (unpinned) nodes
		const elkPositions = await layoutCalm(model, pinnedIds, direction, sizeHints);

		// Build final position map: ELK results + pinned node current positions
		const finalPositions = new Map<
			string,
			{ x: number; y: number; width?: number; height?: number }
		>();

		// Inject pinned positions from current canvas state
		for (const n of nodes) {
			if (pinnedIds.has(n.id)) {
				const hint = sizeHints.get(n.id);
				finalPositions.set(n.id, {
					...n.position,
					width: hint?.width ?? n.measured?.width ?? n.width,
					height: hint?.height ?? n.measured?.height ?? n.height,
				});
			}
		}

		// Add ELK-computed positions for free nodes (include width/height for projection)
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
		setCleanSnapshot(getModelJson());

		function handleKeydown(e: KeyboardEvent) {
			// Option+N (Mac) / Alt+N: new diagram
			// Use e.code because Option+N produces 'ñ' for e.key on Mac
			if (e.altKey && e.code === 'KeyN') {
				e.preventDefault();
				handleNew();
				return;
			}

			// C4 view shortcuts (1-4) — only when not editing text (Pitfall 6)
			if (!e.metaKey && !e.ctrlKey && !e.altKey) {
				const tag = document.activeElement?.tagName;
				if (
					tag !== 'INPUT' &&
					tag !== 'TEXTAREA' &&
					!document.activeElement?.closest('[contenteditable]')
				) {
					if (e.key === '1') {
						e.preventDefault();
						handleC4LevelChange(null);
						return;
					}
					if (e.key === '2') {
						e.preventDefault();
						handleC4LevelChange('context');
						return;
					}
					if (e.key === '3') {
						e.preventDefault();
						handleC4LevelChange('container');
						return;
					}
					if (e.key === '4') {
						e.preventDefault();
						handleC4LevelChange('component');
						return;
					}
				}
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
		const dirty = isDocumentModified;

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
			onexportsvg={handleExportSvg}
			onexportpng={handleExportPng}
			onexportcalmscript={handleExportCalmscript}
			onexportscalertoml={handleExportScalerToml}
			onloaddemo={handleLoadDemo}
			ontemplates={() => (showTemplatePicker = true)}
			filename={getFileName()}
			isDirty={isDocumentModified}
			c4Level={getC4Level()}
			onc4levelchange={handleC4LevelChange}
			governanceScore={getArchitectureScore()}
			showGovernanceBadge={hasAINodes()}
			showScalerTomlExport={showScalerTomlExport}
			flows={flows}
			activeFlowId={activeFlowId}
			onflowchange={setActiveFlowId}
		/>

		<DiagramTabBar
			tabs={diagramTabs}
			{activeTabId}
			isTabDirty={isTabDirty}
			onactivate={handleActivateTab}
			onclose={handleCloseTab}
			onnew={handleNewTab}
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
		{#if referenceFocusWarning}
			<div class="error-banner" role="status">
				<span class="error-message">{referenceFocusWarning}</span>
				<button
					type="button"
					class="error-dismiss"
					onclick={() => (referenceFocusWarning = null)}
					aria-label="Dismiss warning"
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

		<!-- Main content: three-column canvas + bottom code panel + validation drawer -->
		<PaneGroup direction="vertical" class="main-pane-group">
			<!-- Top: Three-column layout (palette | canvas | properties) -->
			<Pane defaultSize={60} minSize={30}>
				<PaneGroup direction="horizontal" style="height: 100%;">
					<!-- Left: Node Palette (hidden in C4 mode) -->
					{#if !isC4Mode()}
						<Pane defaultSize={15} minSize={8}>
							<LeftSidebar
								bind:this={leftSidebar}
								onplacenode={handlePalettePlace}
								currentFileRelativePath={getFileRelativePath()}
								onopenexplorerfile={handleOpenExplorerFile}
							/>
						</Pane>

						<PaneResizer class="resizer resizer-vertical" />
					{/if}

					<!-- Center: Canvas area -->
					<Pane defaultSize={70}>
						<div
							class="canvas-pane"
							class:c4-context={getC4Level() === 'context'}
							class:c4-container={getC4Level() === 'container'}
							class:c4-component={getC4Level() === 'component'}
							role="main"
						>
							<!-- C4 Breadcrumb navigation bar (visible only in C4 mode) -->
							{#if isC4Mode()}
								<C4Breadcrumb
									level={getC4Level()!}
									drillStack={getC4DrillStack()}
									onnavigate={handleBreadcrumbNavigate}
									levelBadge={getC4Level()!.charAt(0).toUpperCase() + getC4Level()!.slice(1)}
								/>
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

							{#key tabRenderKey}
							<SvelteFlowProvider>
								{#if isC4Mode() && c4DisplayNodes.length === 0}
									<!-- Empty C4 view -->
									<div class="c4-empty-state">
										<p>No {getC4Level()} level nodes found in this architecture.</p>
										<p class="c4-empty-hint">Try a different C4 level, or add {getC4Level()} type nodes to your architecture.</p>
									</div>
								{:else if isC4Mode()}
									<!-- C4 mode: pass derived display arrays (cannot bind: to derived) -->
									<CalmCanvas
										bind:this={canvas}
										nodes={c4DisplayNodes}
										edges={c4DisplayEdges}
										readonly={true}
										ondblclicknode={handleC4DrillDown}
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
										onfileimport={handleFileImport}
										oncanvaschange={markDirty}
										onnavigatereference={handleNavigateReference}
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
							{/key}
						</div>
					</Pane>

					<PaneResizer class="resizer resizer-vertical" />

					<!-- Right: Properties panel -->
					<Pane defaultSize={15} minSize={5}>
						<PropertiesPanel
							{selectedNode}
							{selectedEdge}
							onBeforeFirstEdit={handleBeforeFirstEdit}
							onmutate={handlePropertyMutation}
							onswapedge={handleSwapSelectedEdge}
							ontogglepin={handleTogglePin}
							onopenreference={handleNavigateReference}
							onextract={handleExtractRequest}
							readonly={isC4Mode()}
						/>
					</Pane>
				</PaneGroup>
			</Pane>

			<PaneResizer class="resizer resizer-horizontal" />

			<!-- Middle: Code editor panel (full width) -->
			<Pane defaultSize={25} minSize={10}>
				{#key tabRenderKey}
				<CodePanel
					value={calmJson}
					onchange={handleCodeChange}
					parseError={codeParseError}
					selectedNodeId={selectedNodeId}
					selectedEdgeId={selectedEdgeId}
				/>
				{/key}
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

		{#if showUnsavedDialog}
			<UnsavedChangesDialog
				filename={getFileName()}
				onsave={() => resolveUnsavedDialog('save')}
				ondiscard={() => resolveUnsavedDialog('discard')}
				oncancel={() => resolveUnsavedDialog('cancel')}
			/>
		{/if}

		{#if outsideProjectHref}
			<OutsideProjectInfobox
				href={outsideProjectHref}
				onclose={() => (outsideProjectHref = null)}
			/>
		{/if}

		{#if extractDialog}
			<ExtractToDiagramDialog
				defaultFolder={extractDialog.folder}
				defaultFileName={extractDialog.fileName}
				warning={extractDialog.warning}
				onconfirm={(r) => void handleExtractConfirm(r)}
				oncancel={() => (extractDialog = null)}
			/>
		{/if}

		{#if extractError}
			<div class="extract-error" role="alert">
				<span>{extractError}</span>
				<button type="button" onclick={() => (extractError = null)}>Dismiss</button>
			</div>
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
	/* External architecture reference nodes (drag from file explorer) */
	:global(.svelte-flow__node.reference-node) {
		outline: 2px dashed var(--color-accent, #3b82f6);
		outline-offset: 2px;
		border-radius: 10px;
	}

	/* Full-height app shell — toolbar + pane group stack vertically */
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
	}

	/* ─── Status bar ────────────────────────────────────────────── */

	.extract-error {
		position: fixed;
		bottom: 36px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10001;
		display: flex;
		align-items: center;
		gap: 12px;
		max-width: min(560px, calc(100vw - 24px));
		padding: 10px 14px;
		border-radius: 8px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
		font-size: 12px;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
	}

	.extract-error button {
		flex-shrink: 0;
		padding: 4px 10px;
		border-radius: 4px;
		border: 1px solid #fecaca;
		background: #fff;
		color: #991b1b;
		font-size: 11px;
		cursor: pointer;
	}

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

	.c4-empty-hint {
		font-size: 13px;
		color: #9ca3af;
	}

	:global(.dark) .c4-empty-state {
		color: #9ca3af;
	}

	:global(.dark) .c4-empty-hint {
		color: #6b7280;
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
