<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { NeighborHit } from './findNeighbors';
	import { filterNeighborHits } from './findNeighbors';

	interface Props {
		hits: NeighborHit[];
		loading?: boolean;
		error?: string | null;
		searchRoots?: string[];
		onconfirm: (selected: NeighborHit[]) => void;
		oncancel: () => void;
	}

	let {
		hits,
		loading = false,
		error = null,
		searchRoots = [],
		onconfirm,
		oncancel,
	}: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());
	let nodeTypeFilter = $state('');
	let relTypeFilter = $state('');

	const nodeTypes = $derived([...new Set(hits.map((h) => h.neighborNodeType))].sort());
	const relTypes = $derived([...new Set(hits.map((h) => h.relationshipType))].sort());

	const filtered = $derived(
		filterNeighborHits(hits, {
			nodeTypes: nodeTypeFilter ? new Set([nodeTypeFilter]) : undefined,
			relationshipTypes: relTypeFilter ? new Set([relTypeFilter]) : undefined,
		})
	);

	const selectedCount = $derived(filtered.filter((h) => selectedIds.has(h.rowId)).length);

	function toggle(rowId: string) {
		const next = new Set(selectedIds);
		if (next.has(rowId)) next.delete(rowId);
		else next.add(rowId);
		selectedIds = next;
	}

	function selectAllVisible() {
		const next = new Set(selectedIds);
		for (const h of filtered) next.add(h.rowId);
		selectedIds = next;
	}

	function clearSelection() {
		selectedIds = new Set();
	}

	function submit() {
		const selected = filtered.filter((h) => selectedIds.has(h.rowId));
		if (selected.length === 0) return;
		onconfirm(selected);
	}

	function handleBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) oncancel();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		}
	}

	function directionLabel(d: NeighborHit['direction']): string {
		if (d === 'in') return '←';
		if (d === 'out') return '→';
		return '↔';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="neighbors-title">
		<h2 id="neighbors-title" class="title">Find neighbors</h2>
		{#if searchRoots.length > 0}
			<p class="scope">Search roots: {searchRoots.join(', ')}</p>
		{:else}
			<p class="scope">Search roots: entire project</p>
		{/if}
		{#if loading}
			<p class="hint">Scanning project…</p>
		{:else if error}
			<p class="error" role="alert">{error}</p>
		{:else if hits.length === 0}
			<p class="hint">No project-wide neighbors found for this node.</p>
		{:else}
			<div class="filters">
				<label class="field">
					<span class="label">Node type</span>
					<select bind:value={nodeTypeFilter}>
						<option value="">All</option>
						{#each nodeTypes as t}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span class="label">Relationship</span>
					<select bind:value={relTypeFilter}>
						<option value="">All</option>
						{#each relTypes as t}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</label>
				<div class="filter-actions">
					<button type="button" class="linkish" onclick={selectAllVisible}>Select visible</button>
					<button type="button" class="linkish" onclick={clearSelection}>Clear</button>
				</div>
			</div>
			<ul class="list" role="listbox" aria-multiselectable="true">
				{#each filtered as hit (hit.rowId)}
					<li>
						<label class="row">
							<input
								type="checkbox"
								checked={selectedIds.has(hit.rowId)}
								onchange={() => toggle(hit.rowId)}
							/>
							<span class="name">{hit.neighborName}</span>
							<span class="meta">{hit.neighborNodeType}</span>
							<span class="meta">{directionLabel(hit.direction)} {hit.relationshipType}</span>
							<span class="path" title={hit.sourceRelativePath}>{hit.sourceRelativePath}</span>
						</label>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button
				type="button"
				class="btn primary"
				onclick={submit}
				disabled={loading || selectedCount === 0}
			>
				Add selected{selectedCount > 0 ? ` (${selectedCount})` : ''}
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(2px);
	}
	.dialog {
		width: min(640px, calc(100vw - 32px));
		max-height: min(80vh, 720px);
		display: flex;
		flex-direction: column;
		padding: 20px 22px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		box-shadow: 0 20px 40px rgba(15, 23, 42, 0.18);
	}
	.title {
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 600;
	}
	.scope {
		margin: -4px 0 12px;
		font-size: 12px;
		color: var(--color-text-secondary, #64748b);
	}
	.hint,
	.error {
		margin: 0 0 12px;
		font-size: 13px;
		color: var(--color-text-secondary, #475569);
	}
	.error {
		color: #b91c1c;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
		margin-bottom: 10px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
	}
	.label {
		color: var(--color-text-secondary, #64748b);
	}
	select {
		min-width: 140px;
		padding: 5px 8px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #cbd5e1);
		font-size: 12px;
	}
	.filter-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.linkish {
		border: none;
		background: transparent;
		color: var(--color-accent, #2563eb);
		font-size: 12px;
		cursor: pointer;
		padding: 4px;
	}
	.list {
		list-style: none;
		margin: 0 0 14px;
		padding: 0;
		overflow: auto;
		flex: 1;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 8px;
		min-height: 120px;
	}
	.row {
		display: grid;
		grid-template-columns: auto 1fr auto auto minmax(80px, 1.2fr);
		gap: 8px;
		align-items: center;
		padding: 8px 10px;
		font-size: 12px;
		border-bottom: 1px solid var(--color-border, #f1f5f9);
		cursor: pointer;
	}
	.row:hover {
		background: #f8fafc;
	}
	.name {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		color: var(--color-text-secondary, #64748b);
		white-space: nowrap;
	}
	.path {
		color: #94a3b8;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: right;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #cbd5e1);
		background: #fff;
		font-size: 12px;
		cursor: pointer;
	}
	.btn.primary {
		background: var(--color-accent, #2563eb);
		border-color: var(--color-accent, #2563eb);
		color: #fff;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
