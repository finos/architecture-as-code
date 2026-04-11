<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  NodeProperties.svelte — Node metadata form fields for the properties panel.
  Displays and edits CALM node fields: unique-id (read-only), name, description,
  node-type dropdown, interfaces (via InterfaceList), controls placeholder,
  and custom properties (via CustomMetadata).

  Before the first mutation per selection, calls onBeforeFirstEdit() if provided
  (used by the parent to push a history snapshot before changes begin).
-->
<script lang="ts">
	import type { Node } from '@xyflow/svelte';
	import type { CalmNodeType } from '@calmstudio/calm-core';
	import { updateNodeProperty } from '$lib/stores/calmModel.svelte';
	import InterfaceList from './InterfaceList.svelte';
	import ControlsList from './ControlsList.svelte';
	import CustomMetadata from './CustomMetadata.svelte';

	let {
		node,
		onBeforeFirstEdit,
		onmutate,
		ontogglepin,
	}: {
		node: Node;
		/** Called once before the first mutation per selection — used to push undo snapshot. */
		onBeforeFirstEdit?: () => void;
		/** Called after each property mutation to re-project canvas and code panel. */
		onmutate?: () => void;
		/** Called to toggle pin state for this node. */
		ontogglepin?: (nodeId: string) => void;
	} = $props();

	const CALM_NODE_TYPES: CalmNodeType[] = [
		'actor',
		'system',
		'service',
		'database',
		'network',
		'webclient',
		'ecosystem',
		'ldap',
		'data-asset',
	];

	// Track whether the first edit has been signaled for this selection
	let firstEditSignaled = $state(false);

	// Reset flag when node selection changes
	$effect(() => {
		// Access node.id to create a reactive dependency on selection change
		const _id = node.id;
		firstEditSignaled = false;
	});

	// Local state for debounced fields
	let localName = $state(String(node.data?.label ?? node.data?.calmId ?? ''));
	let localDescription = $state(String(node.data?.description ?? ''));
	let localCustomType = $state('');

	// Sync local state when node changes (selection change)
	$effect(() => {
		localName = String(node.data?.label ?? node.data?.calmId ?? '');
		localDescription = String(node.data?.description ?? '');
		// Reset custom type when selection changes
		localCustomType = '';
	});

	const calmType: string = $derived(String(node.data?.calmType ?? 'system'));
	const isCustomType: boolean = $derived(!CALM_NODE_TYPES.includes(calmType as CalmNodeType));

	let nameTimer: ReturnType<typeof setTimeout>;
	let descTimer: ReturnType<typeof setTimeout>;
	let customTypeTimer: ReturnType<typeof setTimeout>;

	function signalFirstEdit() {
		if (!firstEditSignaled) {
			firstEditSignaled = true;
			onBeforeFirstEdit?.();
		}
	}

	function handleNameInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		localName = value;
		signalFirstEdit();
		clearTimeout(nameTimer);
		nameTimer = setTimeout(() => {
			updateNodeProperty(node.data.calmId, 'name', value);
			onmutate?.();
		}, 300);
	}

	function handleDescriptionInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		localDescription = value;
		signalFirstEdit();
		clearTimeout(descTimer);
		descTimer = setTimeout(() => {
			updateNodeProperty(node.data.calmId, 'description', value);
			onmutate?.();
		}, 300);
	}

	function handleTypeChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		signalFirstEdit();
		if (value !== 'custom') {
			updateNodeProperty(node.data.calmId, 'node-type', value);
			onmutate?.();
		}
		// If custom, wait for the custom input to commit
	}

	function handleCustomTypeInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		localCustomType = value;
		signalFirstEdit();
		clearTimeout(customTypeTimer);
		customTypeTimer = setTimeout(() => {
			if (value.trim()) {
				updateNodeProperty(node.data.calmId, 'node-type', value.trim());
				onmutate?.();
			}
		}, 300);
	}

	function getTypeLabel(type: string): string {
		return type
			.split('-')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}
</script>

<div class="node-props">
	<!-- Header -->
	<div class="props-header">
		<span class="header-label">Node Properties</span>
		<div class="header-actions">
			{#if ontogglepin}
				<button
					type="button"
					class="pin-toggle-btn"
					class:pinned={node.data?.pinned}
					onclick={() => ontogglepin(node.id)}
					title={node.data?.pinned ? 'Unpin node (will move in auto-layout)' : 'Pin node (stays fixed in auto-layout)'}
					aria-label={node.data?.pinned ? 'Unpin node' : 'Pin node'}
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill={node.data?.pinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" aria-hidden="true">
						<path d="M12 2L8 8H4l4 6v4l4-2 4 2v-4l4-6h-4L12 2z" stroke-linecap="round" stroke-linejoin="round" />
						<line x1="12" y1="18" x2="12" y2="22" stroke-linecap="round" />
					</svg>
					<span class="pin-label">{node.data?.pinned ? 'Pinned' : 'Pin'}</span>
				</button>
			{/if}
			<span class="type-badge">{getTypeLabel(calmType)}</span>
		</div>
	</div>

	<!-- Core fields -->
	<div class="fields">
		<!-- unique-id: read-only -->
		<div class="field">
			<label class="field-label" for="node-unique-id">Unique ID</label>
			<div class="read-only-field" id="node-unique-id" title={node.data?.calmId}>{node.data?.calmId}</div>
		</div>

		<!-- name -->
		<div class="field">
			<label class="field-label" for="node-name">Name</label>
			<input
				id="node-name"
				class="field-input"
				type="text"
				value={localName}
				oninput={handleNameInput}
				placeholder="Node name"
				aria-label="Node name"
			/>
		</div>

		<!-- description -->
		<div class="field">
			<label class="field-label" for="node-description">Description</label>
			<textarea
				id="node-description"
				class="field-textarea"
				rows={3}
				value={localDescription}
				oninput={handleDescriptionInput}
				placeholder="Node description"
				aria-label="Node description"
			></textarea>
		</div>

		<!-- node-type dropdown -->
		<div class="field">
			<label class="field-label" for="node-type">Node Type</label>
			<select
				id="node-type"
				class="field-select"
				value={isCustomType ? 'custom' : calmType}
				onchange={handleTypeChange}
				aria-label="Node type"
			>
				{#each CALM_NODE_TYPES as t}
					<option value={t}>{getTypeLabel(t)}</option>
				{/each}
				<option value="custom">Custom...</option>
			</select>
		</div>

		<!-- Custom type input (shown when "custom" is selected) -->
		{#if isCustomType || (calmType === 'custom')}
			<div class="field">
				<label class="field-label" for="node-custom-type">Custom Type</label>
				<input
					id="node-custom-type"
					class="field-input"
					type="text"
					value={isCustomType ? calmType : localCustomType}
					oninput={handleCustomTypeInput}
					placeholder="Enter custom type"
					aria-label="Custom node type string"
				/>
			</div>
		{/if}
	</div>

	<!-- Interfaces section -->
	<InterfaceList nodeId={node.data?.calmId} interfaces={node.data?.interfaces ?? []} {onmutate} />

	<!-- Controls section (CALM 1.2) -->
	<ControlsList
		controls={node.data?.controls}
		onupdate={(newControls) => {
			signalFirstEdit();
			updateNodeProperty(node.data.calmId, 'controls', newControls);
			onmutate?.();
		}}
		readonly={!onmutate}
	/>

	<!-- Custom metadata section -->
	<CustomMetadata nodeId={node.data?.calmId} metadata={node.data?.customMetadata ?? {}} {onmutate} />
</div>

<style>
	.node-props {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow-y: auto;
		font-family: var(--font-sans, inherit);
	}

	.props-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 12px 10px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .props-header {
		border-color: #1e293b;
	}

	.header-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary, #94a3b8);
	}

	:global(.dark) .header-label {
		color: #64748b;
	}

	.type-badge {
		font-size: 10px;
		font-weight: 600;
		padding: 2px 7px;
		border-radius: 10px;
		background: var(--color-surface-secondary, #f1f5f9);
		color: var(--color-text-secondary, #64748b);
		white-space: nowrap;
	}

	:global(.dark) .type-badge {
		background: #1e293b;
		color: #94a3b8;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pin-toggle-btn {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 2px 6px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: var(--color-surface, #fff);
		color: var(--color-text-tertiary, #94a3b8);
		font-size: 10px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}

	.pin-toggle-btn:hover {
		background: var(--color-surface-secondary, #f1f5f9);
		color: var(--color-text-primary, #1e293b);
	}

	.pin-toggle-btn.pinned {
		color: var(--color-accent, #3b82f6);
		border-color: var(--color-accent, #3b82f6);
		background: rgba(59, 130, 246, 0.08);
	}

	:global(.dark) .pin-toggle-btn {
		background: #111827;
		border-color: #334155;
		color: #64748b;
	}

	:global(.dark) .pin-toggle-btn:hover {
		background: #1e293b;
		color: #e2e8f0;
	}

	:global(.dark) .pin-toggle-btn.pinned {
		color: #60a5fa;
		border-color: #60a5fa;
		background: rgba(96, 165, 250, 0.1);
	}

	.pin-label {
		line-height: 1;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.field-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-tertiary, #94a3b8);
	}

	:global(.dark) .field-label {
		color: #64748b;
	}

	.read-only-field {
		height: 32px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		font-size: 12px;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-tertiary, #94a3b8);
		background: var(--color-surface-secondary, #f8fafc);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: default;
		user-select: all;
	}

	:global(.dark) .read-only-field {
		background: #0f1320;
		border-color: #334155;
		color: #64748b;
	}

	.field-input {
		height: 32px;
		padding: 0 8px;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		outline: none;
		transition: border-color 0.15s ease;
	}

	.field-input:focus {
		border-color: var(--color-accent, #6366f1);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
	}

	:global(.dark) .field-input {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .field-input:focus {
		border-color: #818cf8;
		box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.12);
	}

	.field-textarea {
		padding: 6px 8px;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		outline: none;
		resize: vertical;
		min-height: 60px;
		transition: border-color 0.15s ease;
		line-height: 1.4;
	}

	.field-textarea:focus {
		border-color: var(--color-accent, #6366f1);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
	}

	:global(.dark) .field-textarea {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .field-textarea:focus {
		border-color: #818cf8;
		box-shadow: 0 0 0 2px rgba(129, 140, 248, 0.12);
	}

	.field-select {
		height: 32px;
		padding: 0 8px;
		font-size: 12px;
		font-family: inherit;
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		outline: none;
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.field-select:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .field-select {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	:global(.dark) .field-select:focus {
		border-color: #818cf8;
	}

</style>
