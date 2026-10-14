<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resizeAdjacentColumns } from './columnResize';

	export interface ColumnDef {
		id: string;
		label: string;
		width: number;
	}

	interface Props {
		columns: ColumnDef[];
		rowIds: string[];
		cell: Snippet<[rowId: string, columnId: string]>;
	}

	let { columns, rowIds, cell }: Props = $props();

	let widths = $state<number[]>([]);
	let columnKey = $state('');

	$effect(() => {
		const nextKey = columns.map((column) => column.id).join('|');
		if (nextKey !== columnKey) {
			columnKey = nextKey;
			widths = columns.map((column) => column.width);
		}
	});

	const template = $derived(widths.map((width) => `${width}px`).join(' '));
	const tableWidth = $derived(widths.reduce((sum, width) => sum + width, 0));

	function startResize(edgeIndex: number, event: PointerEvent) {
		event.preventDefault();
		event.stopPropagation();
		const startX = event.clientX;
		const start = widths.slice();
		const move = (e: PointerEvent) => {
			widths = resizeAdjacentColumns(start, edgeIndex, e.clientX - startX);
		};
		const stop = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', stop);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', stop);
	}
</script>

<div class="column-grid" style:width="{tableWidth}px">
	<div class="header" style:grid-template-columns={template} role="row">
		{#each columns as column, index (column.id)}
			<div class="head" role="columnheader">
				<span>{column.label}</span>
				{#if index < columns.length - 1}
					<button
						type="button"
						class="edge"
						aria-label={`Resize ${column.label}`}
						onpointerdown={(event) => startResize(index, event)}
					></button>
				{/if}
			</div>
		{/each}
	</div>
	{#each rowIds as rowId (rowId)}
		<div class="data" style:grid-template-columns={template} role="row">
			{#each columns as column (column.id)}
				<div class="cell">
					{@render cell(rowId, column.id)}
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.column-grid {
		min-width: 100%;
	}

	.header,
	.data {
		display: grid;
		align-items: stretch;
	}

	.header {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--color-surface, #fff);
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary, #64748b);
	}

	.head {
		position: relative;
		padding: 6px 8px;
		min-width: 0;
	}

	.edge {
		position: absolute;
		top: 0;
		right: -3px;
		width: 6px;
		height: 100%;
		padding: 0;
		border: none;
		background: transparent;
		cursor: col-resize;
	}

	.edge:hover {
		background: var(--color-accent, #3b82f6);
		opacity: 0.45;
	}

	.data {
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		font-size: 12px;
	}

	.cell {
		min-width: 0;
		padding: 4px 8px;
		overflow: hidden;
	}
</style>
