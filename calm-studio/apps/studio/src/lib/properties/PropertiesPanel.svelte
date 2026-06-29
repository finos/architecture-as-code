<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  PropertiesPanel.svelte — Outer shell for the right sidebar with tab navigation.
  Routes to NodeProperties / EdgeProperties (Properties tab) or GovernancePanel (Governance tab).
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
	import GovernancePanel from '$lib/governance/GovernancePanel.svelte';
	import { isAINode } from '@calmstudio/calm-core';

	let {
		selectedNode = null,
		selectedEdge = null,
		onBeforeFirstEdit,
		onmutate,
		ontogglepin,
		readonly = false,
	}: {
		selectedNode?: Node | null;
		selectedEdge?: Edge | null;
		/** Forwarded to NodeProperties/EdgeProperties for undo snapshot before first edit. */
		onBeforeFirstEdit?: () => void;
		/** Called after each property mutation to re-project canvas and code panel. */
		onmutate?: () => void;
		/** Called to toggle pin state for a node. */
		ontogglepin?: (nodeId: string) => void;
		/** When true, renders node/edge info but disables all editing (C4 view mode). */
		readonly?: boolean;
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
</script>

<aside class="properties-panel" class:collapsed={!hasSelection} aria-label="Properties panel">
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
				<GovernancePanel
					selectedNodeId={activeNode ? String(activeNode.data?.calmId ?? activeNode.id) : null}
					selectedNodeType={activeNode ? String(activeNode.data?.calmType ?? '') : null}
					onBeforeFirstEdit={readonly ? undefined : onBeforeFirstEdit}
					onmutate={readonly ? undefined : onmutate}
				/>
			{/if}
		</div>
	{:else}
		<!-- Collapsed strip — thin panel with rotated "Properties" label -->
		<div class="collapsed-strip" aria-label="Properties panel — nothing selected">
			<svg
				class="panel-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M9 3v18M3 9h6M3 15h6" stroke-linecap="round" />
			</svg>
			<span class="collapsed-label">Properties</span>
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

	/* ─── Collapsed state ────────────────────────────────────────── */

	/* Collapsed state — ~40px wide strip */
	.properties-panel.collapsed {
		width: 40px;
		min-width: 40px;
		max-width: 40px;
		align-items: center;
	}

	.collapsed-strip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 16px 0;
		width: 100%;
	}

	.panel-icon {
		width: 16px;
		height: 16px;
		color: var(--color-text-tertiary, #94a3b8);
		flex-shrink: 0;
	}

	:global(.dark) .panel-icon {
		color: #475569;
	}

	.collapsed-label {
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--color-text-tertiary, #94a3b8);
		writing-mode: vertical-rl;
		text-orientation: mixed;
		transform: rotate(180deg);
	}

	:global(.dark) .collapsed-label {
		color: #475569;
	}
</style>
