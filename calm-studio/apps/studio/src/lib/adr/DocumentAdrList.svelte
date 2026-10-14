<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import ColumnGrid from '$lib/ui/ColumnGrid.svelte';
	import { moveAdr, removeAdr, replaceAdr } from '$lib/adr/adrs';

	interface Props {
		adrs: string[];
		readonly?: boolean;
		canAddLocal?: boolean;
		onview: (ref: string) => void;
		onaddhub: () => void;
		onaddlocal: () => void;
		onchange: (next: string[]) => void;
	}

	let {
		adrs,
		readonly = false,
		canAddLocal = false,
		onview,
		onaddhub,
		onaddlocal,
		onchange,
	}: Props = $props();

	let drafts = $state<string[]>([]);
	let syncKey = $state('');

	$effect(() => {
		const nextKey = adrs.join('\u0000');
		if (nextKey !== syncKey) {
			syncKey = nextKey;
			drafts = [...adrs];
		}
	});

	const columns = [
		{ id: 'adr', label: 'ADR', width: 220 },
		{ id: 'actions', label: 'Actions', width: 168 },
	];

	const rowIds = $derived(adrs.map((_, index) => String(index)));

	function commit(index: number) {
		const next = replaceAdr(adrs, index, drafts[index] ?? '');
		if (!next) {
			drafts[index] = adrs[index] ?? '';
			return;
		}
		if (next !== adrs) onchange(next);
	}
</script>

<section class="adr-list" aria-label="Architecture decision records">
	<h3 class="title">ADRs</h3>
	{#if adrs.length === 0}
		<p class="empty">No ADRs on this diagram.</p>
	{:else}
		<div class="scroll">
			<ColumnGrid {columns} {rowIds} cell={cell} />
		</div>
	{/if}
	<div class="add">
		<button type="button" onclick={onaddhub} disabled={readonly}>Add from Hub…</button>
		<button
			type="button"
			onclick={onaddlocal}
			disabled={readonly || !canAddLocal}
			title={canAddLocal ? 'Add a file relative to this diagram' : 'Save the diagram before adding a local ADR'}
		>
			Add local file…
		</button>
	</div>
</section>

{#snippet cell(rowId: string, columnId: string)}
	{@const index = Number(rowId)}
	{#if columnId === 'adr'}
		<input
			class="path"
			title={adrs[index]}
			bind:value={drafts[index]}
			disabled={readonly}
			onblur={() => commit(index)}
		/>
	{:else}
		<div class="actions">
			<button type="button" onclick={() => onview(adrs[index] ?? '')}>View</button>
			<button type="button" disabled={readonly || index === 0} onclick={() => onchange(moveAdr(adrs, index, -1))} aria-label="Move up">↑</button>
			<button type="button" disabled={readonly || index === adrs.length - 1} onclick={() => onchange(moveAdr(adrs, index, 1))} aria-label="Move down">↓</button>
			<button type="button" disabled={readonly} onclick={() => onchange(removeAdr(adrs, index))} aria-label="Remove">×</button>
		</div>
	{/if}
{/snippet}

<style>
	.adr-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		min-height: 0;
		padding: 10px;
		overflow: hidden;
	}

	.title {
		margin: 0;
		font-size: 13px;
	}

	.empty {
		margin: 0;
		font-size: 12px;
		color: var(--color-text-secondary, #64748b);
	}

	.scroll {
		overflow: auto;
		min-height: 0;
		flex: 1;
	}

	.path {
		width: 100%;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 4px;
		padding: 2px 4px;
		font: inherit;
		background: transparent;
		color: inherit;
	}

	.actions {
		display: flex;
		gap: 4px;
	}

	.add {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	button {
		font: inherit;
		font-size: 11px;
		border: 1px solid var(--color-border, #e2e8f0);
		background: var(--color-surface, #fff);
		border-radius: 4px;
		cursor: pointer;
		padding: 2px 6px;
	}

	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
