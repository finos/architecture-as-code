<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { UsageHit } from './findUsage';
	import ColumnGrid from '$lib/ui/ColumnGrid.svelte';

	interface Props {
		hits: UsageHit[];
		loading?: boolean;
		error?: string | null;
		onopen: (hit: UsageHit) => void;
		oncancel: () => void;
	}

	let {
		hits,
		loading = false,
		error = null,
		onopen,
		oncancel,
	}: Props = $props();

	let selectedId = $state<string | null>(null);

	const selected = $derived(hits.find((h) => h.rowId === selectedId) ?? null);

	const columns = [
		{ id: 'path', label: 'Path', width: 200 },
		{ id: 'kind', label: 'Kind', width: 90 },
		{ id: 'meta', label: 'Detail', width: 120 },
		{ id: 'name', label: 'Name', width: 160 },
	];

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			oncancel();
		}
	}

	function kindLabel(h: UsageHit): string {
		if (h.kind === 'node') return 'stub';
		return h.variant ?? 'relationship';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="backdrop" role="presentation">
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="usage-title">
		<h2 id="usage-title" class="title">Find usage</h2>
		{#if loading}
			<p class="hint">Scanning project…</p>
		{:else if error}
			<p class="error" role="alert">{error}</p>
		{:else if hits.length === 0}
			<p class="hint">No usages in other files.</p>
		{:else}
			<div class="table-scroll">
				<ColumnGrid columns={columns} rowIds={hits.map((hit) => hit.rowId)} cell={usageCell} />
			</div>
		{/if}
		<div class="actions">
			<button type="button" onclick={oncancel}>Cancel</button>
			<button
				type="button"
				class="primary"
				disabled={!selected}
				onclick={() => selected && onopen(selected)}
			>
				Open selected
			</button>
		</div>
	</div>
</div>

{#snippet usageCell(rowId: string, columnId: string)}
	{@const hit = hits.find((item) => item.rowId === rowId)}
	{#if hit}
		{#if columnId === 'path'}
			<button type="button" class="cell-btn" class:selected={selectedId === hit.rowId} title={hit.relativePath} onclick={() => (selectedId = hit.rowId)} ondblclick={() => onopen(hit)}>{hit.relativePath}</button>
		{:else if columnId === 'kind'}
			<span title={hit.kind}>{hit.kind}</span>
		{:else if columnId === 'meta'}
			<span title={kindLabel(hit)}>{kindLabel(hit)}</span>
		{:else}
			<span title={hit.name}>{hit.name}</span>
		{/if}
	{/if}
{/snippet}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgb(15 23 42 / 45%);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.dialog {
		width: min(640px, 92vw);
		max-height: 80vh;
		overflow: auto;
		background: #fff;
		border-radius: 10px;
		padding: 16px 18px;
		box-shadow: 0 16px 40px rgb(0 0 0 / 18%);
	}
	.title {
		margin: 0 0 8px;
		font-size: 16px;
	}
	.hint,
	.error {
		font-size: 13px;
		color: #64748b;
	}
	.error {
		color: #b91c1c;
	}
	.table-scroll {
		overflow: auto;
		max-height: 50vh;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
	}
	.cell-btn {
		width: 100%;
		text-align: left;
		border: none;
		background: transparent;
		cursor: pointer;
		font: inherit;
		padding: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.cell-btn.selected {
		background: #eff6ff;
	}
	.path {
		color: #334155;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kind,
	.meta {
		color: #64748b;
		font-variant: small-caps;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 12px;
	}
	.primary {
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 6px;
		padding: 6px 12px;
		cursor: pointer;
	}
	.primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
