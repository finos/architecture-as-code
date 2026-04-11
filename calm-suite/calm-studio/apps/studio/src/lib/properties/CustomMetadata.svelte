<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  CustomMetadata.svelte — Key-value pair editor for CALM custom metadata.
  Supports add (key locked after creation), edit value, and remove.
-->
<script lang="ts">
	import {
		addCustomMetadata,
		removeCustomMetadata,
	} from '$lib/stores/calmModel.svelte';

	let {
		nodeId,
		metadata = {},
		onmutate,
	}: { nodeId: string; metadata: Record<string, string>; onmutate?: () => void } = $props();

	// Local state for the "new row" form
	let newKey = $state('');
	let newValue = $state('');
	let showNewRow = $state(false);
	let newKeyInput: HTMLInputElement | undefined;

	// Debounce timers per key
	let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	const entries = $derived(Object.entries(metadata));

	function handleValueChange(key: string, value: string) {
		clearTimeout(debounceTimers[key]);
		debounceTimers[key] = setTimeout(() => {
			addCustomMetadata(nodeId, key, value);
			onmutate?.();
		}, 300);
	}

	function handleDelete(key: string) {
		removeCustomMetadata(nodeId, key);
		onmutate?.();
	}

	function handleAddClick() {
		showNewRow = true;
		// Focus the key input on next tick
		setTimeout(() => newKeyInput?.focus(), 0);
	}

	function handleKeyBlur() {
		const trimmed = newKey.trim();
		if (trimmed) {
			addCustomMetadata(nodeId, trimmed, newValue);
			onmutate?.();
			newKey = '';
			newValue = '';
			showNewRow = false;
		}
	}

	function handleNewRowKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			handleKeyBlur();
		} else if (e.key === 'Escape') {
			newKey = '';
			newValue = '';
			showNewRow = false;
		}
	}
</script>

<div class="section">
	<div class="section-header">
		<span class="section-label">Custom Properties</span>
		{#if entries.length > 0}
			<span class="badge">{entries.length}</span>
		{/if}
	</div>

	{#if entries.length > 0}
		<div class="metadata-list">
			{#each entries as [key, value] (key)}
				<div class="metadata-row">
					<input
						class="key-input"
						type="text"
						value={key}
						disabled
						aria-label="Property key (read-only)"
						title={key}
					/>
					<input
						class="value-input"
						type="text"
						value={value}
						oninput={(e) => handleValueChange(key, (e.target as HTMLInputElement).value)}
						placeholder="value"
						aria-label="Property value for {key}"
					/>
					<button
						class="delete-btn"
						onclick={() => handleDelete(key)}
						aria-label="Remove property {key}"
						title="Remove property"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{:else if !showNewRow}
		<p class="empty-hint">No custom properties</p>
	{/if}

	{#if showNewRow}
		<div class="metadata-row new-row">
			<input
				bind:this={newKeyInput}
				class="key-input new-key"
				type="text"
				bind:value={newKey}
				onblur={handleKeyBlur}
				onkeydown={handleNewRowKeydown}
				placeholder="key"
				aria-label="New property key"
			/>
			<input
				class="value-input"
				type="text"
				bind:value={newValue}
				onkeydown={handleNewRowKeydown}
				placeholder="value"
				aria-label="New property value"
			/>
			<button
				class="delete-btn"
				onclick={() => { showNewRow = false; newKey = ''; newValue = ''; }}
				aria-label="Cancel new property"
				title="Cancel"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
		<p class="new-hint">Tab/Enter to save &middot; Esc to cancel</p>
	{/if}

	{#if !showNewRow}
		<button class="add-btn" onclick={handleAddClick} type="button">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add Property
		</button>
	{/if}
</div>

<style>
	.section {
		padding: 10px 12px;
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .section {
		border-color: #1e293b;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}

	.section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary, #94a3b8);
	}

	:global(.dark) .section-label {
		color: #64748b;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		font-size: 10px;
		font-weight: 600;
		background: var(--color-surface-secondary, #f1f5f9);
		color: var(--color-text-secondary, #64748b);
	}

	:global(.dark) .badge {
		background: #1e293b;
		color: #94a3b8;
	}

	.metadata-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 6px;
	}

	.metadata-row {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 32px;
	}

	.key-input {
		flex: 0 0 auto;
		width: 90px;
		height: 28px;
		padding: 0 8px;
		font-size: 11px;
		font-family: inherit;
		font-weight: 500;
		color: var(--color-text-secondary, #475569);
		background: var(--color-surface-secondary, #f8fafc);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		outline: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.key-input:disabled {
		cursor: default;
		opacity: 0.8;
	}

	.new-key {
		background: var(--color-surface, #fff);
		color: var(--color-text-primary, #1e293b);
	}

	.new-key:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .key-input {
		background: #0f1320;
		border-color: #334155;
		color: #94a3b8;
	}

	:global(.dark) .new-key {
		background: #1e293b;
		color: #e2e8f0;
	}

	:global(.dark) .new-key:focus {
		border-color: #818cf8;
	}

	.value-input {
		flex: 1;
		min-width: 0;
		height: 28px;
		padding: 0 8px;
		font-size: 11px;
		font-family: inherit;
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.value-input::placeholder {
		color: var(--color-text-tertiary, #94a3b8);
	}

	.value-input:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .value-input {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .value-input::placeholder {
		color: #475569;
	}

	:global(.dark) .value-input:focus {
		border-color: #818cf8;
	}

	.delete-btn {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-tertiary, #94a3b8);
		border-radius: 4px;
		padding: 2px;
		transition: all 0.15s ease;
	}

	.delete-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}

	:global(.dark) .delete-btn:hover {
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
	}

	.delete-btn svg {
		width: 12px;
		height: 12px;
	}

	.empty-hint {
		font-size: 11px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 0 0 6px;
		font-style: italic;
	}

	:global(.dark) .empty-hint {
		color: #475569;
	}

	.new-hint {
		font-size: 10px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 2px 0 6px;
		text-align: center;
	}

	:global(.dark) .new-hint {
		color: #475569;
	}

	.add-btn {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 8px;
		font-size: 11px;
		font-family: inherit;
		font-weight: 500;
		color: var(--color-accent, #6366f1);
		background: none;
		border: 1px dashed var(--color-accent, #6366f1);
		border-radius: 5px;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.75;
	}

	.add-btn:hover {
		opacity: 1;
		background: var(--color-accent-subtle, rgba(99, 102, 241, 0.06));
	}

	:global(.dark) .add-btn {
		color: #818cf8;
		border-color: #818cf8;
	}

	:global(.dark) .add-btn:hover {
		background: rgba(129, 140, 248, 0.08);
	}

	.add-btn svg {
		width: 12px;
		height: 12px;
	}
</style>
