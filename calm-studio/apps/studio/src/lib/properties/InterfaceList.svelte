<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  InterfaceList.svelte — Inline interface rows with add/edit/remove.
  Displays all CALM interfaces on a node with type dropdown and value input.
-->
<script lang="ts">
	import { nanoid } from 'nanoid';
	import type { CalmInterface } from '@calmstudio/calm-core';
	import {
		addInterface,
		removeInterface,
		updateInterface,
	} from '$lib/stores/calmModel.svelte';

	let {
		nodeId,
		interfaces = [],
		onmutate,
	}: { nodeId: string; interfaces: CalmInterface[]; onmutate?: () => void } = $props();

	const INTERFACE_TYPES = ['url', 'host-port', 'container-image', 'port', 'custom'] as const;

	// Debounce timers per interface ID
	let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	function handleTypeChange(iface: CalmInterface, newType: string) {
		updateInterface(nodeId, iface['unique-id'], { type: newType });
		onmutate?.();
	}

	function handleValueChange(iface: CalmInterface, newValue: string) {
		clearTimeout(debounceTimers[iface['unique-id']]);
		debounceTimers[iface['unique-id']] = setTimeout(() => {
			updateInterface(nodeId, iface['unique-id'], { value: newValue });
			onmutate?.();
		}, 300);
	}

	function handleDelete(iface: CalmInterface) {
		removeInterface(nodeId, iface['unique-id']);
		onmutate?.();
	}

	function handleAdd() {
		addInterface(nodeId, { 'unique-id': nanoid(), type: 'url', value: '' });
		onmutate?.();
	}
</script>

<div class="section">
	<div class="section-header">
		<span class="section-label">Interfaces</span>
		{#if interfaces.length > 0}
			<span class="badge">{interfaces.length}</span>
		{/if}
	</div>

	{#if interfaces.length > 0}
		<div class="interface-list">
			{#each interfaces as iface (iface['unique-id'])}
				<div class="interface-row">
					<select
						class="type-select"
						value={iface.type}
						onchange={(e) => handleTypeChange(iface, (e.target as HTMLSelectElement).value)}
						aria-label="Interface type"
					>
						{#each INTERFACE_TYPES as t}
							<option value={t} selected={iface.type === t}>{t}</option>
						{/each}
						{#if !INTERFACE_TYPES.includes(iface.type as typeof INTERFACE_TYPES[number])}
							<option value={iface.type} selected>{iface.type}</option>
						{/if}
					</select>
					<input
						class="value-input"
						type="text"
						value={iface.value ?? ''}
						oninput={(e) => handleValueChange(iface, (e.target as HTMLInputElement).value)}
						placeholder="value"
						aria-label="Interface value"
					/>
					<button
						class="delete-btn"
						onclick={() => handleDelete(iface)}
						aria-label="Remove interface"
						title="Remove interface"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{:else}
		<p class="empty-hint">No interfaces defined</p>
	{/if}

	<button class="add-btn" onclick={handleAdd} type="button">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
			<line x1="12" y1="5" x2="12" y2="19" />
			<line x1="5" y1="12" x2="19" y2="12" />
		</svg>
		Add Interface
	</button>
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

	.interface-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 6px;
	}

	.interface-row {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 32px;
	}

	.type-select {
		flex: 0 0 auto;
		width: 110px;
		height: 28px;
		padding: 0 6px;
		font-size: 11px;
		font-family: inherit;
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		outline: none;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.type-select:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .type-select {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .type-select:focus {
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
