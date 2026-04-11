<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  EdgeProperties.svelte — Relationship metadata form fields for the properties panel.
  Displays and edits CALM edge fields: unique-id (read-only), relationship-type,
  protocol (for connects/interacts), description, source and destination (read-only).
-->
<script lang="ts">
	import type { Edge } from '@xyflow/svelte';
	import type { CalmRelationshipType } from '@calmstudio/calm-core';
	import { updateEdgeProperty } from '$lib/stores/calmModel.svelte';
	import ControlsList from './ControlsList.svelte';

	let {
		edge,
		onBeforeFirstEdit,
		onmutate,
	}: {
		edge: Edge;
		/** Called once before the first mutation per selection — used to push undo snapshot. */
		onBeforeFirstEdit?: () => void;
		/** Called after each property mutation to re-project canvas and code panel. */
		onmutate?: () => void;
	} = $props();

	const RELATIONSHIP_TYPES: CalmRelationshipType[] = [
		'connects',
		'interacts',
		'deployed-in',
		'composed-of',
		'options',
	];

	const PROTOCOL_TYPES = ['connects', 'interacts'];

	const COMMON_PROTOCOLS = [
		'HTTPS',
		'HTTP',
		'gRPC',
		'GraphQL',
		'WebSocket',
		'AMQP',
		'MQTT',
		'Kafka',
		'TCP',
		'UDP',
		'JDBC',
		'ODBC',
		'SFTP',
		'SSH',
	];

	let showCustomProtocol = $state(false);
	let firstEditSignaled = $state(false);

	// Reset flag when edge selection changes
	$effect(() => {
		const _id = edge.id;
		firstEditSignaled = false;
		// Show custom input if current protocol isn't in the common list
		const currentProto = String(edge.data?.protocol ?? '');
		showCustomProtocol = currentProto !== '' && !COMMON_PROTOCOLS.includes(currentProto);
	});

	// Local state for debounced fields
	let localDescription = $state(String(edge.data?.description ?? ''));
	let localProtocol = $state(String(edge.data?.protocol ?? ''));

	$effect(() => {
		localDescription = String(edge.data?.description ?? '');
		localProtocol = String(edge.data?.protocol ?? '');
	});

	const relType: CalmRelationshipType = $derived(
		(edge.data?.calmRelType ?? edge.type ?? 'connects') as CalmRelationshipType
	);
	const showProtocol: boolean = $derived(PROTOCOL_TYPES.includes(relType));

	let descTimer: ReturnType<typeof setTimeout>;
	let protocolTimer: ReturnType<typeof setTimeout>;

	function signalFirstEdit() {
		if (!firstEditSignaled) {
			firstEditSignaled = true;
			onBeforeFirstEdit?.();
		}
	}

	function handleRelTypeChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		signalFirstEdit();
		updateEdgeProperty(edge.id, 'relationship-type', value);
		onmutate?.();
	}

	function handleProtocolSelect(e: Event) {
		const value = (e.target as HTMLSelectElement).value;
		if (value === '__custom__') {
			showCustomProtocol = true;
			localProtocol = '';
			return;
		}
		showCustomProtocol = false;
		localProtocol = value;
		signalFirstEdit();
		updateEdgeProperty(edge.id, 'protocol', value);
		onmutate?.();
	}

	function handleProtocolInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		localProtocol = value;
		signalFirstEdit();
		clearTimeout(protocolTimer);
		protocolTimer = setTimeout(() => {
			updateEdgeProperty(edge.id, 'protocol', value);
			onmutate?.();
		}, 300);
	}

	function handleDescriptionInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		localDescription = value;
		signalFirstEdit();
		clearTimeout(descTimer);
		descTimer = setTimeout(() => {
			updateEdgeProperty(edge.id, 'description', value);
			onmutate?.();
		}, 300);
	}

	function getTypeLabel(type: string): string {
		return type
			.split('-')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}
</script>

<div class="edge-props">
	<!-- Header -->
	<div class="props-header">
		<span class="header-label">Relationship Properties</span>
		<span class="type-badge">{getTypeLabel(relType)}</span>
	</div>

	<!-- Core fields -->
	<div class="fields">
		<!-- unique-id: read-only -->
		<div class="field">
			<label class="field-label" for="edge-unique-id">Unique ID</label>
			<div class="read-only-field" id="edge-unique-id" title={edge.id}>{edge.id}</div>
		</div>

		<!-- relationship-type dropdown -->
		<div class="field">
			<label class="field-label" for="edge-rel-type">Relationship Type</label>
			<select
				id="edge-rel-type"
				class="field-select"
				value={relType}
				onchange={handleRelTypeChange}
				aria-label="Relationship type"
			>
				{#each RELATIONSHIP_TYPES as t}
					<option value={t}>{getTypeLabel(t)}</option>
				{/each}
			</select>
		</div>

		<!-- protocol (connects + interacts only) -->
		{#if showProtocol}
			<div class="field">
				<label class="field-label" for="edge-protocol">Protocol</label>
				<select
					id="edge-protocol"
					class="field-select"
					value={showCustomProtocol ? '__custom__' : localProtocol}
					onchange={handleProtocolSelect}
					aria-label="Protocol"
				>
					<option value="">— Select —</option>
					{#each COMMON_PROTOCOLS as proto}
						<option value={proto}>{proto}</option>
					{/each}
					<option value="__custom__">Custom...</option>
				</select>
			</div>
			{#if showCustomProtocol}
				<div class="field">
					<label class="field-label" for="edge-protocol-custom">Custom Protocol</label>
					<input
						id="edge-protocol-custom"
						class="field-input"
						type="text"
						value={localProtocol}
						oninput={handleProtocolInput}
						placeholder="e.g. NATS, Redis Pub/Sub"
						aria-label="Custom protocol"
					/>
				</div>
			{/if}
		{/if}

		<!-- description -->
		<div class="field">
			<label class="field-label" for="edge-description">Description</label>
			<textarea
				id="edge-description"
				class="field-textarea"
				rows={2}
				value={localDescription}
				oninput={handleDescriptionInput}
				placeholder="Relationship description"
				aria-label="Relationship description"
			></textarea>
		</div>

		<!-- source: read-only -->
		<div class="field">
			<label class="field-label" for="edge-source">Source</label>
			<div class="read-only-field" id="edge-source" title={edge.source}>{edge.source}</div>
		</div>

		<!-- destination: read-only -->
		<div class="field">
			<label class="field-label" for="edge-dest">Destination</label>
			<div class="read-only-field" id="edge-dest" title={edge.target}>{edge.target}</div>
		</div>
	</div>

	<!-- Controls section (CALM 1.2) -->
	<ControlsList
		controls={edge.data?.controls}
		onupdate={(newControls) => {
			signalFirstEdit();
			updateEdgeProperty(edge.id, 'controls', newControls);
			onmutate?.();
		}}
		readonly={!onmutate}
	/>
</div>

<style>
	.edge-props {
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
		min-height: 50px;
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
