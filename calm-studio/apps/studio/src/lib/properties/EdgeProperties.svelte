<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  EdgeProperties.svelte — Relationship metadata form fields for the properties panel.
  Displays and edits CALM edge fields: unique-id (read-only), relationship-type,
  protocol (for connects/interacts), description, source and destination (read-only).
-->
<script lang="ts">
	import type { Edge } from '@xyflow/svelte';
	import type { CalmRelationshipVariant } from '@calmstudio/calm-core';
	import { getContainerAndNodes } from '@calmstudio/calm-core';
	import { deleteEdgeProperty, updateEdgeProperty, getModel } from '$lib/stores/calmModel.svelte';
	import ControlsList from './ControlsList.svelte';
	import MetadataForm from './MetadataForm.svelte';
	import { asCalmFlowEdgeData } from '$lib/canvas/flowTypes';
	import { getMetadataFieldsForRelationship } from '$lib/metadata/metadataForm';
	import { resolveVariantSyncFromMetadata } from '$lib/metadata/relationshipVariantSync';
	import {
		relationshipTypeChoices,
		relationshipTypeForChoice,
		replaceTypeBoundMetadata,
	} from '$lib/relationships/relationshipTypeChoice';

	const SWAPPABLE_VARIANTS: CalmRelationshipVariant[] = [
		'connects',
		'interacts',
		'composed-of',
		'deployed-in',
	];

	let {
		edge,
		onBeforeFirstEdit,
		onmutate,
		onswap,
		oncontainmentmembers,
	}: {
		edge: Edge;
		/** Called once before the first mutation per selection — used to push undo snapshot. */
		onBeforeFirstEdit?: () => void;
		/** Called after each property mutation to re-project canvas and code panel. */
		onmutate?: () => void;
		/** Called to swap edge direction (source ↔ target). */
		onswap?: () => void;
		/** Replace composed-of / deployed-in member list (R38). */
		oncontainmentmembers?: (nextNodeIds: string[]) => void;
	} = $props();

	const ed = $derived(asCalmFlowEdgeData(edge.data as Record<string, unknown>));

	function resolveNodeType(nodeId: string): string {
		return getModel().nodes.find((n) => n['unique-id'] === nodeId)?.['node-type'] ?? '';
	}

	const sourceType = $derived(resolveNodeType(edge.source));
	const targetType = $derived(resolveNodeType(edge.target));
	const metadataFields = $derived(getMetadataFieldsForRelationship(sourceType, targetType));
	const edgeMetadata = $derived((ed.metadata as Record<string, unknown> | undefined) ?? {});

	const PROTOCOL_TYPES = ['connects', 'interacts'];
	const canEdit = $derived(Boolean(onmutate));

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
	let styleSectionOpen = $state(false);

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

	const relType: CalmRelationshipVariant = $derived(
		(edge.data?.calmVariant ?? edge.type ?? 'connects') as CalmRelationshipVariant
	);
	const typeKey = $derived(String(ed.relationshipTypeKey ?? relType));
	const typeChoices = $derived(relationshipTypeChoices(typeKey));
	function storedMeta(key: string): string {
		const value = edgeMetadata[key];
		return typeof value === 'string' ? value : '';
	}
	const styleValueCount = $derived(
		['line-style', 'routing', 'line-color', 'text-color', 'description-display'].filter(
			(key) => storedMeta(key),
		).length,
	);
	const showProtocol: boolean = $derived(PROTOCOL_TYPES.includes(relType));
	const canSwapDirection: boolean = $derived(SWAPPABLE_VARIANTS.includes(relType));
	const isContainmentRel: boolean = $derived(relType === 'composed-of' || relType === 'deployed-in');
	const calmRelId: string = $derived(String(ed.calmRelId ?? edge.id));

	const memberIds: string[] = $derived.by(() => {
		if (!isContainmentRel) return [];
		const rel = getModel().relationships.find((r) => r['unique-id'] === calmRelId);
		if (!rel) return [edge.target];
		return getContainerAndNodes(rel)?.nodes ?? [edge.target];
	});

	const addableNodeIds: string[] = $derived(
		getModel()
			.nodes.map((n) => n['unique-id'])
			.filter((id) => id !== edge.source && !memberIds.includes(id))
	);

	let addMemberId = $state('');

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
		const previousType = typeKey;
		const chosen = relationshipTypeForChoice(value, edge.source, edge.target);
		updateEdgeProperty(calmRelId, 'relationship-type', chosen.relationshipType);
		const rel = getModel().relationships.find((r) => r['unique-id'] === calmRelId);
		const currentMeta = rel?.metadata;
		const metaRecord =
			currentMeta && !Array.isArray(currentMeta)
				? (currentMeta as Record<string, unknown>)
				: undefined;
		const nextMeta = replaceTypeBoundMetadata(metaRecord, previousType, value, chosen.canvasVariant);
		updateEdgeProperty(calmRelId, 'metadata', nextMeta ?? {});
		if (chosen.canvasVariant !== 'connects' && chosen.canvasVariant !== 'interacts') {
			deleteEdgeProperty(calmRelId, 'protocol');
		}
		onmutate?.();
	}

	function setAppearanceKey(key: string, value: string) {
		if (!canEdit) return;
		signalFirstEdit();
		const rel = getModel().relationships.find((r) => r['unique-id'] === calmRelId);
		const currentMeta = rel?.metadata;
		const metadata = {
			...(currentMeta && !Array.isArray(currentMeta)
				? (currentMeta as Record<string, unknown>)
				: {}),
		};
		if (value === '') delete metadata[key];
		else metadata[key] = value;
		updateEdgeProperty(calmRelId, 'metadata', metadata);
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
		updateEdgeProperty(calmRelId, 'protocol', value);
		onmutate?.();
	}

	function handleProtocolInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		localProtocol = value;
		signalFirstEdit();
		clearTimeout(protocolTimer);
		protocolTimer = setTimeout(() => {
			updateEdgeProperty(calmRelId, 'protocol', value);
			onmutate?.();
		}, 300);
	}

	function handleDescriptionInput(e: Event) {
		const value = (e.target as HTMLTextAreaElement).value;
		localDescription = value;
		signalFirstEdit();
		clearTimeout(descTimer);
		descTimer = setTimeout(() => {
			updateEdgeProperty(calmRelId, 'description', value);
			onmutate?.();
		}, 300);
	}

	function handleSwapDirection() {
		signalFirstEdit();
		onswap?.();
	}

	function removeMember(id: string) {
		signalFirstEdit();
		oncontainmentmembers?.(memberIds.filter((m) => m !== id));
	}

	function addMember() {
		const id = addMemberId.trim();
		if (!id || memberIds.includes(id)) return;
		signalFirstEdit();
		oncontainmentmembers?.([...memberIds, id]);
		addMemberId = '';
	}

	function handleMetadataCommit(next: Record<string, unknown>) {
		const currentVariant = relType;
		const sync = resolveVariantSyncFromMetadata(
			next,
			currentVariant,
			edge.source,
			edge.target,
		);
		updateEdgeProperty(calmRelId, 'metadata', sync.metadata);
		if (sync.relationshipType) {
			updateEdgeProperty(calmRelId, 'relationship-type', sync.relationshipType);
		}
		onmutate?.();
	}

	/** `#rrggbb` for `<input type="color">`. Short and alpha forms keep the text field. */
	function pickerHex(value: string | undefined): string {
		if (!value) return '#000000';
		const short = /^#([0-9A-Fa-f]{3})$/.exec(value);
		if (short?.[1]) {
			const [r, g, b] = short[1];
			return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
		}
		const full = /^#([0-9A-Fa-f]{6})/i.exec(value);
		return full?.[1] ? `#${full[1].toLowerCase()}` : '#000000';
	}
</script>

<div class="edge-props">
	<!-- Header -->
	<div class="props-header">
		<span class="header-label">Relationship Properties</span>
		<span class="type-badge">{typeKey}</span>
	</div>

	<!-- Core fields -->
	<div class="fields">
		<!-- unique-id: read-only -->
		<div class="field">
			<label class="field-label" for="edge-unique-id">Unique ID</label>
			<div class="read-only-field" id="edge-unique-id" title={isContainmentRel ? calmRelId : edge.id}>
				{isContainmentRel ? calmRelId : edge.id}
			</div>
		</div>

		<!-- relationship-type dropdown -->
		<div class="field">
			<label class="field-label" for="edge-rel-type">Relationship Type</label>
			<select
				id="edge-rel-type"
				class="field-select"
				value={typeKey}
				onchange={handleRelTypeChange}
				disabled={!canEdit}
				aria-label="Relationship type"
			>
				{#each typeChoices as t (t.value)}
					<option value={t.value}>{t.label}</option>
				{/each}
			</select>
		</div>

		{#if canSwapDirection}
			<div class="field">
				<button type="button" class="swap-btn" onclick={handleSwapDirection}>
					Obrátit směr
				</button>
			</div>
		{/if}

		<!-- protocol (connects + interacts only) -->
		{#if showProtocol}
			<div class="field">
				<label class="field-label" for="edge-protocol">Protocol</label>
				<select
					id="edge-protocol"
					class="field-select"
					value={showCustomProtocol ? '__custom__' : localProtocol}
					onchange={handleProtocolSelect}
					disabled={!canEdit}
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
						disabled={!canEdit}
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

		{#if isContainmentRel}
			<div class="field">
				<label class="field-label" for="edge-container">Container</label>
				<div class="read-only-field" id="edge-container" title={edge.source}>{edge.source}</div>
			</div>
			<div class="field">
				<span class="field-label">Members (nodes)</span>
				<ul class="member-list">
					{#each memberIds as mid (mid)}
						<li class="member-row">
							<code>{mid}</code>
							{#if oncontainmentmembers}
								<button type="button" class="member-remove" onclick={() => removeMember(mid)} aria-label="Remove {mid}">
									×
								</button>
							{/if}
						</li>
					{/each}
				</ul>
				{#if oncontainmentmembers && addableNodeIds.length > 0}
					<div class="member-add">
						<select class="field-select" bind:value={addMemberId} aria-label="Add node unique-id">
							<option value="">Add node unique-id</option>
							{#each addableNodeIds as nid (nid)}
								<option value={nid}>{nid}</option>
							{/each}
						</select>
						<button type="button" class="swap-btn" onclick={addMember} disabled={!addMemberId}>Add</button>
					</div>
				{/if}
			</div>
		{:else}
			<div class="field">
				<label class="field-label" for="edge-source">Source</label>
				<div class="read-only-field" id="edge-source" title={edge.source}>{edge.source}</div>
			</div>
			<div class="field">
				<label class="field-label" for="edge-dest">Destination</label>
				<div class="read-only-field" id="edge-dest" title={edge.target}>{edge.target}</div>
			</div>
		{/if}
	</div>

	<section class="section">
		<button
			type="button"
			class="section-toggle"
			onclick={() => (styleSectionOpen = !styleSectionOpen)}
			aria-expanded={styleSectionOpen}
		>
			<span class="chevron" class:open={styleSectionOpen}>
				<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</span>
			<span class="section-label">Visual style</span>
			{#if styleValueCount > 0}
				<span class="badge">{styleValueCount}</span>
			{/if}
		</button>
		{#if styleSectionOpen}
		<div class="fields section-fields">
			<div class="field">
				<label class="field-label" for="edge-line-style">Line style</label>
				<select
					id="edge-line-style"
					class="field-select"
					value={storedMeta('line-style')}
					disabled={!canEdit}
					aria-label="Line style"
					onchange={(e) => setAppearanceKey('line-style', (e.target as HTMLSelectElement).value)}
				>
					<option value=""></option>
					<option value="solid">solid</option>
					<option value="dashed">dashed</option>
					<option value="dotted">dotted</option>
				</select>
			</div>
			<div class="field">
				<label class="field-label" for="edge-routing">Routing</label>
				<select
					id="edge-routing"
					class="field-select"
					value={storedMeta('routing')}
					disabled={!canEdit}
					aria-label="Routing"
					onchange={(e) => setAppearanceKey('routing', (e.target as HTMLSelectElement).value)}
				>
					<option value=""></option>
					<option value="bezier">bezier</option>
					<option value="smoothstep">smoothstep</option>
					<option value="straight">straight</option>
				</select>
			</div>
			<div class="field">
				<label class="field-label" for="edge-line-color">Line color</label>
				<div class="color-row">
					<input
						class="color-picker"
						type="color"
						value={pickerHex(storedMeta('line-color') || undefined)}
						disabled={!canEdit}
						aria-label="Line color picker"
						onchange={(e) => setAppearanceKey('line-color', (e.target as HTMLInputElement).value.toLowerCase())}
					/>
					<input
						id="edge-line-color"
						class="field-input"
						type="text"
						value={storedMeta('line-color')}
						placeholder="#rrggbb"
						disabled={!canEdit}
						aria-label="Line color"
						onchange={(e) => setAppearanceKey('line-color', (e.target as HTMLInputElement).value.trim().toLowerCase())}
					/>
				</div>
			</div>
			<div class="field">
				<label class="field-label" for="edge-text-color">Text color</label>
				<div class="color-row">
					<input
						class="color-picker"
						type="color"
						value={pickerHex(storedMeta('text-color') || undefined)}
						disabled={!canEdit}
						aria-label="Text color picker"
						onchange={(e) => setAppearanceKey('text-color', (e.target as HTMLInputElement).value.toLowerCase())}
					/>
					<input
						id="edge-text-color"
						class="field-input"
						type="text"
						value={storedMeta('text-color')}
						placeholder="#rrggbb"
						disabled={!canEdit}
						aria-label="Text color"
						onchange={(e) => setAppearanceKey('text-color', (e.target as HTMLInputElement).value.trim().toLowerCase())}
					/>
				</div>
			</div>
			<div class="field">
				<label class="field-label" for="edge-desc-display">Description display</label>
				<select
					id="edge-desc-display"
					class="field-select"
					value={storedMeta('description-display')}
					disabled={!canEdit}
					aria-label="Description display"
					onchange={(e) =>
						setAppearanceKey('description-display', (e.target as HTMLSelectElement).value)}
				>
					<option value=""></option>
					<option value="tooltip">tooltip</option>
					<option value="label">label</option>
				</select>
			</div>
		</div>
		{/if}
	</section>

	<!-- Schema-driven relationship metadata (R17) -->
	<MetadataForm
		elementId={edge.id}
		fields={metadataFields}
		nodeType={sourceType}
		metadata={edgeMetadata}
		autoBindCalmCoreVariant={true}
		schemaKind="relationship"
		onBeforeFirstEdit={signalFirstEdit}
		onCommit={
			onmutate
				? (next) => {
						signalFirstEdit();
						handleMetadataCommit(next);
					}
				: undefined
		}
	/>

	<!-- Controls section (CALM 1.2) -->
	<ControlsList
		controls={ed.controls}
		onupdate={(newControls) => {
			signalFirstEdit();
			updateEdgeProperty(calmRelId, 'controls', newControls);
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

	.section {
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .section {
		border-color: #1e293b;
	}

	.section-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 10px 12px 8px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.section-toggle:hover {
		background: var(--color-surface-secondary, #f8fafc);
	}

	:global(.dark) .section-toggle:hover {
		background: #0f172a;
	}

	.chevron {
		display: flex;
		align-items: center;
		color: var(--color-text-tertiary, #94a3b8);
		transition: transform 0.15s;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary, #94a3b8);
		flex: 1;
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

	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px 12px;
	}

	.section-fields {
		padding: 0 12px 10px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.member-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.member-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		font-size: 12px;
		padding: 2px 0;
	}
	.member-remove {
		border: none;
		background: transparent;
		color: #b91c1c;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
	}
	.member-add {
		display: flex;
		gap: 8px;
		margin-top: 6px;
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

	.color-row {
		display: flex;
		gap: 6px;
		align-items: center;
	}

	.color-row .field-input {
		flex: 1;
		min-width: 0;
	}

	.color-picker {
		width: 32px;
		height: 32px;
		padding: 2px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: var(--color-surface, #fff);
		cursor: pointer;
	}

	.color-picker:disabled {
		cursor: default;
		opacity: 0.6;
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

	.swap-btn {
		width: 100%;
		padding: 6px 10px;
		font-size: 12px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #e2e8f0);
		background: var(--color-surface, #fff);
		cursor: pointer;
	}

	.swap-btn:hover {
		border-color: var(--color-accent, #6366f1);
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
