<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  NodeSearch.svelte — Floating search bar for filtering canvas nodes.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import type { Node } from '@xyflow/svelte';
	import { createNodeSearcher, searchNodes } from './search';

	let {
		nodes = [],
		onresults,
		onclose,
	}: {
		nodes?: Node[];
		onresults?: (ids: string[]) => void;
		onclose?: () => void;
	} = $props();

	let query = $state('');
	let inputEl: HTMLInputElement;

	let searcher = $derived(createNodeSearcher(nodes));
	let matchIds = $derived(searchNodes(searcher, query));
	let matchCount = $derived(matchIds.length);
	let totalCount = $derived(nodes.length);

	$effect(() => {
		onresults?.(matchIds);
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose?.();
		}
	}

	onMount(() => {
		inputEl?.focus();
	});
</script>

<div
	class="search-panel"
	role="search"
	aria-label="Search nodes"
>
	<div class="search-row">
		<svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.35-4.35" />
		</svg>

		<input
			bind:this={inputEl}
			bind:value={query}
			type="text"
			placeholder="Search nodes..."
			onkeydown={handleKeydown}
			class="search-input"
			aria-label="Node search input"
		/>

		<button
			onclick={() => onclose?.()}
			class="close-btn"
			aria-label="Close search"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	{#if query.trim()}
		<div class="result-count">
			{matchCount} of {totalCount} node{totalCount !== 1 ? 's' : ''}
		</div>
	{/if}
</div>

<style>
	.search-panel {
		position: absolute;
		right: 16px;
		top: 16px;
		z-index: 50;
		width: 260px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
		font-family: var(--node-font);
		overflow: hidden;
	}

	:global(.dark) .search-panel {
		background: #111827;
		border-color: #334155;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
	}

	.search-icon {
		width: 16px;
		height: 16px;
		color: var(--color-text-tertiary);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		background: transparent;
		border: none;
		outline: none;
		font-size: 13px;
		font-family: inherit;
		color: var(--color-text-primary);
	}

	.search-input::placeholder {
		color: var(--color-text-tertiary);
	}

	:global(.dark) .search-input {
		color: #e2e8f0;
	}

	:global(.dark) .search-input::placeholder {
		color: #64748b;
	}

	.close-btn {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-tertiary);
		border-radius: 4px;
		padding: 2px;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		color: var(--color-text-primary);
		background: var(--color-surface-tertiary);
	}

	:global(.dark) .close-btn:hover {
		color: #e2e8f0;
		background: #1e293b;
	}

	.close-btn svg {
		width: 14px;
		height: 14px;
	}

	.result-count {
		padding: 6px 12px;
		font-size: 11px;
		color: var(--color-text-tertiary);
		border-top: 1px solid var(--color-border-subtle);
	}

	:global(.dark) .result-count {
		color: #64748b;
		border-color: #1e293b;
	}
</style>
