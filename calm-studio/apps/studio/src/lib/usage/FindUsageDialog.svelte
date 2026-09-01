<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import type { UsageHit } from './findUsage';

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

	function handleBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) oncancel();
	}

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

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={handleBackdrop}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="usage-title">
		<h2 id="usage-title" class="title">Find usage</h2>
		{#if loading}
			<p class="hint">Scanning project…</p>
		{:else if error}
			<p class="error" role="alert">{error}</p>
		{:else if hits.length === 0}
			<p class="hint">No usages in other files.</p>
		{:else}
			<ul class="list">
				{#each hits as hit (hit.rowId)}
					<li>
						<button
							type="button"
							class="row"
							class:selected={selectedId === hit.rowId}
							onclick={() => (selectedId = hit.rowId)}
							ondblclick={() => onopen(hit)}
						>
							<span class="path">{hit.relativePath}</span>
							<span class="kind">{hit.kind}</span>
							<span class="meta">{kindLabel(hit)}</span>
							<span class="name">{hit.name}</span>
						</button>
					</li>
				{/each}
			</ul>
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
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto auto 1fr;
		gap: 8px;
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		font-size: 12px;
	}
	.row.selected {
		border-color: #93c5fd;
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
