<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { DiagramFilterState } from './diagramFilter';

	interface MetaKey {
		key: string;
		label: string;
	}

	interface Props {
		filter: DiagramFilterState;
		metadataKeys: MetaKey[];
		metadataValues: string[];
		hasSelection: boolean;
		onchange: (next: DiagramFilterState) => void;
	}

	let { filter, metadataKeys, metadataValues, hasSelection, onchange }: Props = $props();

	function setMode(mode: DiagramFilterState['mode']) {
		if (mode === 'focus-neighbors' && !hasSelection) return;
		if (mode === 'metadata') {
			onchange({
				mode: 'metadata',
				metadataKey: filter.metadataKey ?? metadataKeys[0]?.key,
				metadataValue: filter.metadataValue ?? metadataValues[0],
			});
			return;
		}
		onchange({ mode });
	}
</script>

<div class="filter-bar" role="group" aria-label="Diagram filter">
	<span class="label">Filter</span>
	<button
		type="button"
		class="seg"
		class:active={filter.mode === 'off'}
		onclick={() => setMode('off')}
	>
		Off
	</button>
	<button
		type="button"
		class="seg"
		class:active={filter.mode === 'focus-neighbors'}
		disabled={!hasSelection}
		title={hasSelection ? 'Highlight neighbors of selected node' : 'Select a node first'}
		onclick={() => setMode('focus-neighbors')}
	>
		Focus neighbors
	</button>
	<button
		type="button"
		class="seg"
		class:active={filter.mode === 'metadata'}
		disabled={metadataKeys.length === 0}
		onclick={() => setMode('metadata')}
	>
		Metadata
	</button>

	{#if filter.mode === 'metadata'}
		<select
			aria-label="Metadata key"
			value={filter.metadataKey ?? ''}
			onchange={(e) =>
				onchange({
					mode: 'metadata',
					metadataKey: (e.currentTarget as HTMLSelectElement).value,
					metadataValue: undefined,
				})}
		>
			{#each metadataKeys as k}
				<option value={k.key}>{k.label}</option>
			{/each}
		</select>
		<select
			aria-label="Metadata value"
			value={filter.metadataValue ?? ''}
			onchange={(e) =>
				onchange({
					mode: 'metadata',
					metadataKey: filter.metadataKey,
					metadataValue: (e.currentTarget as HTMLSelectElement).value,
				})}
		>
			<option value="">Select value…</option>
			{#each metadataValues as v}
				<option value={v}>{v}</option>
			{/each}
		</select>
	{/if}

	{#if filter.mode !== 'off'}
		<button type="button" class="clear" onclick={() => onchange({ mode: 'off' })}>Clear</button>
	{/if}
</div>

<style>
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		background: var(--toolbar-bg, #f8fafc);
		border-bottom: 1px solid var(--border, #e2e8f0);
		font-size: 12px;
	}
	.label {
		color: var(--text-muted, #64748b);
		margin-right: 4px;
	}
	.seg {
		padding: 4px 8px;
		border: 1px solid var(--border, #cbd5e1);
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		font-size: 11px;
	}
	.seg.active {
		background: #eff6ff;
		border-color: #93c5fd;
		color: #1d4ed8;
	}
	.seg:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	select {
		padding: 3px 6px;
		border-radius: 6px;
		border: 1px solid var(--border, #cbd5e1);
		font-size: 11px;
		max-width: 160px;
	}
	.clear {
		margin-left: 4px;
		border: none;
		background: transparent;
		color: #2563eb;
		cursor: pointer;
		font-size: 11px;
	}
</style>
