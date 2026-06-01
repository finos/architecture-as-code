<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  NodeThreats.svelte — Per-node threats panel (#2551).

  Shows every threat from threat-model decorators that targets the selected
  node, with mitigations and links to controls in the control-catalog
  decorator. Read-only — threats are managed at the decorator level
  (MCP `add_threat_decorator` or sidecar edit), not per-node.
-->
<script lang="ts">
	import {
		threatsForNode,
		controlById,
		decoratorsForNode
	} from '$lib/stores/decorators.svelte';
	import type { CalmThreat } from '@calmstudio/calm-core';

	let { nodeId }: { nodeId: string | null } = $props();

	const threats = $derived<CalmThreat[]>(nodeId ? threatsForNode(nodeId) : []);
	const decoratorIds = $derived(nodeId ? decoratorsForNode(nodeId).map((d) => d['unique-id']) : []);
	const decoratorCount = $derived(decoratorIds.length);

	let expandedThreats = $state<Set<string>>(new Set());

	function toggle(id: string) {
		const next = new Set(expandedThreats);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedThreats = next;
	}

	function controlDescription(id: string): string | null {
		return controlById(id)?.description ?? null;
	}
</script>

<section class="threats-panel" aria-label="Threats for selected node">
	{#if !nodeId}
		<p class="empty">Select a node to view threats.</p>
	{:else if threats.length === 0}
		<p class="empty">No threats reference this node.</p>
	{:else}
		<header class="header">
			<span class="count">{threats.length}</span>
			<span class="label">
				{threats.length === 1 ? 'threat' : 'threats'} from {decoratorCount}
				{decoratorCount === 1 ? 'decorator' : 'decorators'}
			</span>
		</header>
		<ul class="threat-list">
			{#each threats as t (t.id)}
				{@const expanded = expandedThreats.has(t.id)}
				<li class="threat" class:expanded>
					<button
						class="threat-row"
						type="button"
						aria-expanded={expanded}
						onclick={() => toggle(t.id)}
					>
						<span class="threat-id">{t.id}</span>
						<span class="threat-name">{t.name}</span>
						<span class="chev" aria-hidden="true">{expanded ? '▼' : '▶'}</span>
					</button>
					{#if expanded}
						<div class="threat-body">
							<p class="description">{t.description}</p>
							{#if t.mitigations}
								<div class="mitigations">
									<h4>Mitigations</h4>
									<p>{t.mitigations}</p>
								</div>
							{/if}
							{#if t.controls.length > 0}
								<div class="controls">
									<h4>Controls</h4>
									<ul>
										{#each t.controls as cid (cid)}
											<li class="control">
												<span class="cid">{cid}</span>
												<span class="cdesc">{controlDescription(cid) ?? 'Unknown control'}</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
							{#if t.section}
								<p class="meta">Section: {t.section}</p>
							{/if}
							{#if t['affected-layers']?.length}
								<p class="meta">Affected layers: {t['affected-layers'].join(', ')}</p>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.threats-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0;
	}
	.empty {
		color: var(--color-fg-muted, #888);
		font-size: 0.875rem;
		margin: 0.5rem 0;
	}
	.header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.25rem 0;
		border-bottom: 1px solid var(--color-border-default, #ddd);
	}
	.count {
		font-weight: 600;
		font-size: 1rem;
		color: var(--color-danger-emphasis, #cf222e);
	}
	.label {
		font-size: 0.875rem;
		color: var(--color-fg-muted, #888);
	}
	.threat-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.threat {
		border: 1px solid var(--color-border-default, #ddd);
		border-radius: 4px;
		background: var(--color-canvas-subtle, #f6f8fa);
	}
	.threat-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.4rem 0.6rem;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		font-size: 0.875rem;
		color: var(--color-fg-default, #111);
	}
	.threat-row:hover {
		background: var(--color-canvas-default, #fff);
	}
	.threat-id {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.75rem;
		padding: 0.1rem 0.35rem;
		background: var(--color-danger-subtle, #ffebe9);
		border-radius: 3px;
		color: var(--color-danger-fg, #cf222e);
		white-space: nowrap;
	}
	.threat-name {
		flex: 1;
		font-weight: 500;
	}
	.chev {
		color: var(--color-fg-muted, #888);
		font-size: 0.65rem;
	}
	.threat-body {
		padding: 0 0.6rem 0.6rem;
		font-size: 0.8125rem;
		color: var(--color-fg-default, #222);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.threat-body .description {
		margin: 0;
		line-height: 1.4;
	}
	.threat-body h4 {
		margin: 0 0 0.2rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-fg-muted, #888);
	}
	.mitigations p {
		margin: 0;
		line-height: 1.4;
	}
	.controls ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.control {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
	}
	.cid {
		font-family: ui-monospace, SFMono-Regular, monospace;
		font-size: 0.7rem;
		padding: 0.05rem 0.3rem;
		background: var(--color-accent-subtle, #ddf4ff);
		border-radius: 3px;
		color: var(--color-accent-fg, #0969da);
		white-space: nowrap;
	}
	.cdesc {
		font-size: 0.8125rem;
		line-height: 1.35;
	}
	.meta {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-fg-muted, #888);
	}
</style>
