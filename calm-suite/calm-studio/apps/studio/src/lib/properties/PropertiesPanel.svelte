<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  PropertiesPanel.svelte — Outer shell for the right sidebar with tab navigation.
  Routes to NodeProperties / EdgeProperties (Properties tab) or GovernanceView (Governance tab).
  When nothing is selected, shows a collapsed thin strip with a vertical label.

  Tab behavior:
  - "Properties" tab: always shown, contains existing NodeProperties/EdgeProperties
  - "Governance" tab: shown for node selections; badge/dot when AI node selected
  - NO auto-switch to Governance tab (per locked decision: manual tab switch only)
  - Tab resets to 'properties' when selection changes
-->
<script lang="ts">
	import type { Node, Edge } from '@xyflow/svelte';
	import NodeProperties from './NodeProperties.svelte';
	import EdgeProperties from './EdgeProperties.svelte';
	import GovernanceView from '$lib/governance/GovernanceView.svelte';
	import DocumentDecorators from '$lib/decorators/DocumentDecorators.svelte';
	import { rootSystemNodeId, topLevelSystemNodeIds } from '$lib/governance/scope';
	import { getModel } from '$lib/stores/calmModel.svelte';
	import { isAINode, type CalmArchitecture } from '@calmstudio/calm-core';

	let {
		selectedNode = null,
		selectedEdge = null,
		documentArchitecture = null,
		onBeforeFirstEdit,
		onmutate,
		ontogglepin,
		readonly = false,
		onactivetab,
		oncollapse,
	}: {
		selectedNode?: Node | null;
		selectedEdge?: Edge | null;
		/** The document currently shown (editable model, or a C4-drilled doc).
		 * Drives the document-scoped decorator panel; defaults to the live model. */
		documentArchitecture?: CalmArchitecture | null;
		/** Forwarded to NodeProperties/EdgeProperties for undo snapshot before first edit. */
		onBeforeFirstEdit?: () => void;
		/** Called after each property mutation to re-project canvas and code panel. */
		onmutate?: () => void;
		/** Called to toggle pin state for a node. */
		ontogglepin?: (nodeId: string) => void;
		/** When true, renders node/edge info but disables all editing (C4 view mode). */
		readonly?: boolean;
		/** Notifies the host of the active tab, so it can size the panel to fit. */
		onactivetab?: (tab: 'properties' | 'governance') => void;
		/** Folds the panel shut (the host owns the pane). */
		oncollapse?: () => void;
	} = $props();

	/** Prefer node when both are somehow selected. */
	const activeNode: Node | null = $derived(selectedNode ?? null);
	const activeEdge: Edge | null = $derived(!selectedNode ? (selectedEdge ?? null) : null);
	const hasSelection: boolean = $derived(activeNode !== null || activeEdge !== null);

	const headerText: string = $derived(
		activeNode
			? `Node: ${String(activeNode.data?.label ?? activeNode.data?.calmId ?? activeNode.id)}`
			: activeEdge
				? `Edge: ${String(activeEdge.data?.calmRelType ?? activeEdge.type ?? activeEdge.id)}`
				: 'Properties'
	);

	/** Active tab — reset to 'properties' whenever selection changes. */
	let activeTab = $state<'properties' | 'governance'>('properties');

	/** Track previous selection ID to detect changes. */
	let prevSelectionKey = $state<string | null>(null);

	// Reset tab to 'properties' on selection change (per locked decision: no auto-switch)
	$effect(() => {
		const key = activeNode?.id ?? activeEdge?.id ?? null;
		if (key !== prevSelectionKey) {
			prevSelectionKey = key;
			activeTab = 'properties';
		}
	});

	/** Show Governance badge dot when an AI node is selected. */
	const showGovernanceBadge = $derived(
		activeNode !== null &&
		isAINode(String(activeNode.data?.calmType ?? ''))
	);

	/** Show Governance tab when a node is selected (not for edges). */
	const showGovernanceTab = $derived(activeNode !== null);

	/** With nothing selected, governance lives on the document's top-level system node. */
	const topSystems = $derived(hasSelection ? [] : topLevelSystemNodeIds(getModel()));
	/** When a doc has multiple peer systems, the user picks which one to govern. */
	let pickedSystemId = $state<string | null>(null);
	const archSystemId = $derived.by(() => {
		if (hasSelection) return null;
		if (pickedSystemId && topSystems.includes(pickedSystemId)) return pickedSystemId;
		return rootSystemNodeId(getModel());
	});
	const archSystemNode = $derived(
		archSystemId ? (getModel().nodes ?? []).find((n) => n['unique-id'] === archSystemId) : null,
	);
	const nameOf = (id: string) =>
		String((getModel().nodes ?? []).find((n) => n['unique-id'] === id)?.name ?? id);

	// Tell the host which tab is active (Governance needs a wider panel than Properties).
	$effect(() => {
		onactivetab?.(showGovernanceTab && activeTab === 'governance' ? 'governance' : 'properties');
	});
</script>

<aside class="properties-panel" aria-label="Properties panel">
	{#if hasSelection}
		<!-- Tab bar (only shown when a node is selected — edges don't have governance) -->
		{#if showGovernanceTab}
			<div class="tab-bar" role="tablist" aria-label="Properties tabs">
				<button
					type="button"
					class="tab-btn"
					class:active={activeTab === 'properties'}
					role="tab"
					aria-selected={activeTab === 'properties'}
					aria-controls="tab-content-properties"
					onclick={() => (activeTab = 'properties')}
				>
					Properties
				</button>
				<button
					type="button"
					class="tab-btn"
					class:active={activeTab === 'governance'}
					role="tab"
					aria-selected={activeTab === 'governance'}
					aria-controls="tab-content-governance"
					onclick={() => (activeTab = 'governance')}
				>
					Governance
					{#if showGovernanceBadge}
						<span class="tab-badge" aria-label="Governance info available" title="AIGF governance info available for this node"></span>
					{/if}
				</button>
				{#if oncollapse}
					<button type="button" class="collapse-btn" onclick={oncollapse} aria-label="Collapse panel" title="Collapse panel">›</button>
				{/if}
			</div>
		{/if}

		<!-- Tab content -->
		<div
			class="panel-content"
			class:readonly={readonly}
			id="tab-content-{activeTab}"
			role="tabpanel"
		>
			{#if activeTab === 'properties'}
				{#if activeNode}
					<NodeProperties
						node={activeNode}
						onBeforeFirstEdit={readonly ? undefined : onBeforeFirstEdit}
						onmutate={readonly ? undefined : onmutate}
						ontogglepin={readonly ? undefined : ontogglepin}
					/>
				{:else if activeEdge}
					<EdgeProperties
						edge={activeEdge}
						onBeforeFirstEdit={readonly ? undefined : onBeforeFirstEdit}
						onmutate={readonly ? undefined : onmutate}
					/>
				{/if}
			{:else if activeTab === 'governance'}
				<GovernanceView
					elementId={activeNode ? String(activeNode.data?.calmId ?? activeNode.id) : ''}
					nodeType={activeNode ? String(activeNode.data?.calmType ?? '') : null}
					onmutate={readonly ? undefined : onmutate}
					onBeforeEdit={readonly ? undefined : onBeforeFirstEdit}
				/>
			{/if}
		</div>
	{:else}
		<!-- Architecture-level properties (nothing selected) — governance lives on the system node -->
		<div class="panel-content" class:readonly={readonly} aria-label="Architecture properties">
			<div class="arch-header">
				<span class="arch-title">{archSystemNode?.name ?? 'Architecture'}</span>
				<span class="arch-subtitle">
					{archSystemId
						? 'Whole-system governance, inherited by every node it contains'
						: 'Bindings that apply to the whole document'}
				</span>
				{#if topSystems.length > 1}
					<label class="system-pick">
						<span>This document has {topSystems.length} top-level systems — governing:</span>
						<select bind:value={pickedSystemId}>
							{#each topSystems as id}
								<option value={id}>{nameOf(id)}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>
			{#if archSystemId}
				<GovernanceView
					elementId={archSystemId}
					nodeType={archSystemNode?.['node-type'] ?? null}
					onmutate={readonly ? undefined : onmutate}
					onBeforeEdit={readonly ? undefined : onBeforeFirstEdit}
				/>
			{/if}

			<!--
			  Document-scoped decorators (custom, non-Gemara) for the shown doc.
			  This is the single architecture-level decorator surface — it supersets
			  the old per-@architecture GemaraSections (which only showed decorators
			  scoped to the whole document); this also covers ones bound to nodes.
			  Re-scopes on doc switch (open file / C4 drill).
			-->
			<DocumentDecorators
				architecture={documentArchitecture ?? getModel()}
				readonly={readonly}
				onmutate={readonly ? undefined : onmutate}
			/>
		</div>
	{/if}
</aside>

<style>
	.properties-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-surface, #fff);
		border-left: 1px solid var(--color-border, #e2e8f0);
		font-family: var(--font-sans, inherit);
		overflow: hidden;
		min-width: 0;
	}

	:global(.dark) .properties-panel {
		background: #0f1320;
		border-color: #1e293b;
	}

	/* ─── Tab bar ────────────────────────────────────────────────── */

	.tab-bar {
		display: flex;
		height: 32px;
		flex-shrink: 0;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		background: var(--color-surface, #fff);
	}

	:global(.dark) .tab-bar {
		background: #0f1320;
		border-color: #1e293b;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		height: 100%;
		border: none;
		background: none;
		font-size: 11px;
		font-weight: 500;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-secondary, #64748b);
		cursor: pointer;
		transition: all 0.1s ease;
		border-bottom: 2px solid transparent;
		position: relative;
	}

	.tab-btn:hover:not(.active) {
		background: var(--color-surface-secondary, #f8fafc);
		color: var(--color-text-primary, #0f172a);
	}

	.tab-btn.active {
		color: var(--color-accent, #3b82f6);
		border-bottom-color: var(--color-accent, #3b82f6);
		font-weight: 600;
	}

	:global(.dark) .tab-btn {
		color: #64748b;
	}

	:global(.dark) .tab-btn:hover:not(.active) {
		background: #111827;
		color: #94a3b8;
	}

	:global(.dark) .tab-btn.active {
		color: #60a5fa;
		border-bottom-color: #60a5fa;
	}

	/* Collapse-panel button (right of the tabs) */

	.collapse-btn {
		flex-shrink: 0;
		width: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-left: 1px solid var(--color-border, #e2e8f0);
		background: none;
		color: var(--color-text-tertiary, #94a3b8);
		font-size: 15px;
		line-height: 1;
		cursor: pointer;
	}
	.collapse-btn:hover {
		background: var(--color-surface-secondary, #f8fafc);
		color: var(--color-text-primary, #0f172a);
	}
	:global(.dark) .collapse-btn {
		border-color: #1e293b;
		color: #64748b;
	}
	:global(.dark) .collapse-btn:hover {
		background: #111827;
		color: #94a3b8;
	}

	/* Governance badge dot */

	.tab-badge {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #f59e0b;
		flex-shrink: 0;
	}

	:global(.dark) .tab-badge {
		background: #fbbf24;
	}

	/* ─── Panel content ──────────────────────────────────────────── */

	/* Expanded state — full panel content */
	.panel-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}

	/* Readonly state — show node info but prevent editing (C4 view mode) */
	.panel-content.readonly {
		pointer-events: none;
		opacity: 0.7;
	}

	/* ─── Architecture-level header (nothing selected) ───────────── */

	.arch-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 12px 8px;
	}

	.arch-title {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-text-primary, #0f172a);
	}

	:global(.dark) .arch-title {
		color: #e2e8f0;
	}

	.arch-subtitle {
		font-size: 11px;
		color: var(--color-text-tertiary, #94a3b8);
	}

	.system-pick {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 6px;
	}
	.system-pick span {
		font-size: 11px;
		color: var(--color-text-secondary, #64748b);
	}
	.system-pick select {
		font-size: 12px;
		padding: 4px 6px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		background: var(--color-surface, #fff);
		color: var(--color-text-primary, #1e293b);
	}
	:global(.dark) .system-pick select {
		background: #0f1320;
		border-color: #334155;
		color: #e2e8f0;
	}
</style>
