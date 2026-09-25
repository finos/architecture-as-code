<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  MetadataForm.svelte — Schema-driven editor for CALM `metadata` (nodes and relationships).
-->
<script lang="ts">
	import {
		readMetadataPath,
		writeMetadataPath,
		groupMetadataFields,
		previewNestedMetadata,
		type MetadataFieldDescriptor,
	} from '$lib/metadata/metadataForm';
	import { writeArchimateRelationshipMetadata } from '$lib/metadata/relationshipVariantSync';
	import {
		extraMetadataEntries,
		removeExtraMetadata,
		upsertExtraMetadata,
	} from '$lib/metadata/extraMetadata';
	import NestedMetadataDialog from './NestedMetadataDialog.svelte';
	import { getModel } from '$lib/stores/calmModel.svelte';
	import { getProjectConfig, getProjectRootHandle } from '$lib/project/projectStore.svelte';
	import { getPackForNodeType } from '@calmstudio/extensions';
	import {
		logMetadataSchemaResolution,
		resolveMetadataSchemas,
		seedMetadataSchemaUrls,
	} from '$lib/metadata/metadataSchemaResolve';
	import {
		metadataFieldsFromSchemas,
		type MetadataSchemaKind,
	} from '$lib/metadata/metadataFieldsFromSchema';

	let {
		elementId,
		fields = null,
		metadata = {},
		fallbackValues = {},
		readonly = false,
		autoBindCalmCoreVariant = false,
		nodeType = '',
		schemaKind = 'node',
		onBeforeFirstEdit,
		onCommit,
	}: {
		elementId: string;
		fields?: MetadataFieldDescriptor[] | null;
		metadata?: Record<string, unknown>;
		/** Default display when a read-only field path is empty (e.g. element = node-type). */
		fallbackValues?: Record<string, string>;
		readonly?: boolean;
		/** When true, changing archimate.relationship also sets calm-core-variant. */
		autoBindCalmCoreVariant?: boolean;
		/** Node-type (or relationship source type) used to pick pack schemaUrl. */
		nodeType?: string;
		schemaKind?: MetadataSchemaKind;
		onBeforeFirstEdit?: () => void;
		onCommit?: (next: Record<string, unknown>) => void;
	} = $props();

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let firstEditSignaled = $state(false);
	let extraKey = $state('');
	let extraValue = $state('');
	let extraError = $state<string | null>(null);

	let schemaFields = $state<MetadataFieldDescriptor[]>([]);
	const effectiveFields = $derived(fields?.length ? fields : schemaFields);
	const schemaPaths = $derived(effectiveFields.map((f) => f.path));
	const extraEntries = $derived(extraMetadataEntries(metadata, schemaPaths));
	const grouped = $derived(groupMetadataFields(effectiveFields));
	let nestedEdit = $state<
		| { kind: 'schema'; key: string; fields: MetadataFieldDescriptor[] }
		| { kind: 'extra'; key: string; raw: unknown }
		| null
	>(null);

	$effect(() => {
		const _ = elementId;
		firstEditSignaled = false;
	});

	let lastSchemaLogKey = '';
	let schemaLogGen = 0;
	$effect(() => {
		const documentSchema = getModel()['$schema'];
		const mappingPath = getProjectConfig()?.urlMapping?.path;
		const packSchemaUrl = nodeType ? getPackForNodeType(nodeType)?.schemaUrl : undefined;
		const packFieldCount = fields?.length ?? 0;
		const key = JSON.stringify({
			elementId,
			nodeType,
			schemaKind,
			documentSchema,
			mappingPath: mappingPath ?? '',
			packSchemaUrl: packSchemaUrl ?? '',
			packFieldCount,
		});
		if (key === lastSchemaLogKey) return;
		lastSchemaLogKey = key;
		const gen = ++schemaLogGen;
		schemaFields = [];
		const seedUrls = seedMetadataSchemaUrls({ documentSchema, packSchemaUrl });
		void resolveMetadataSchemas(seedUrls, {
			root: getProjectRootHandle(),
			mappingPath,
			hubUrl: getProjectConfig()?.hub?.url,
		}).then((result) => {
			if (gen !== schemaLogGen) return;
			const extracted = metadataFieldsFromSchemas(result.documents, schemaKind);
			schemaFields = extracted.fields;
			const formFieldCount = packFieldCount > 0 ? packFieldCount : extracted.fields.length;
			logMetadataSchemaResolution({
				elementId,
				nodeType,
				formFieldCount,
				schemaFieldSource: packFieldCount > 0 ? undefined : extracted.source,
				seedUrls,
				mappingPath,
				result,
			});
		});
	});

	function signalFirstEdit() {
		if (!firstEditSignaled) {
			firstEditSignaled = true;
			onBeforeFirstEdit?.();
		}
	}

	function handleFieldChange(field: MetadataFieldDescriptor, value: string) {
		if (readonly || field.readOnly || !onCommit) return;
		signalFirstEdit();
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			let next =
				autoBindCalmCoreVariant && field.key === 'relationship'
					? writeArchimateRelationshipMetadata(metadata, value)
					: writeMetadataPath(metadata, field.path, value);
			onCommit(next);
		}, 300);
	}

	function commitExtra(next: Record<string, unknown>) {
		if (readonly || !onCommit) return;
		signalFirstEdit();
		onCommit(next);
	}

	function handleAddExtra() {
		const key = extraKey.trim();
		if (!key) return;
		if (key === '_layout' || key === 'building-block-style' || key === 'fidelity-style') {
			extraError = 'Reserved key — edit layout and colors elsewhere';
			return;
		}
		extraError = null;
		commitExtra(upsertExtraMetadata(metadata, key, extraValue));
		extraKey = '';
		extraValue = '';
	}

	function handleExtraValue(key: string, value: string) {
		commitExtra(upsertExtraMetadata(metadata, key, value));
	}

	function handleRemoveExtra(key: string) {
		commitExtra(removeExtraMetadata(metadata, key));
	}
</script>

<div class="section">
	<div class="section-header">
		<span class="section-label">Metadata</span>
	</div>

		<div class="fields">
			{#each grouped.top as field (field.key)}
				{@const value = readMetadataPath(metadata, field.path)}
				{@const displayValue = value || fallbackValues[field.key] || ''}
				<div class="field">
					<label class="field-label" for="meta-{elementId}-{field.key}">
						{field.label}
						{#if field.required}<span class="required">*</span>{/if}
					</label>

					{#if readonly || field.readOnly}
						<div class="read-only-field" id="meta-{elementId}-{field.key}" title={displayValue}>
							{displayValue || '—'}
						</div>
					{:else if field.kind === 'enum' && field.enumValues}
						<select
							id="meta-{elementId}-{field.key}"
							class="field-select"
							value={displayValue}
							onchange={(e) =>
								handleFieldChange(field, (e.currentTarget as HTMLSelectElement).value)}
							aria-label={field.label}
						>
							<option value="">—</option>
							{#each field.enumValues as option}
								<option value={option}>{option}</option>
							{/each}
						</select>
					{:else}
						<input
							id="meta-{elementId}-{field.key}"
							class="field-input"
							type="text"
							value={displayValue}
							oninput={(e) =>
								handleFieldChange(field, (e.currentTarget as HTMLInputElement).value)}
							aria-label={field.label}
						/>
					{/if}
				</div>
			{/each}

			{#each grouped.nested as group (group.key)}
				<div class="field">
					<span class="field-label">{group.key}</span>
					<div class="nested-preview">
						<code class="preview-text">{previewNestedMetadata(metadata, group.key)}</code>
						{#if !readonly && onCommit}
							<button
								type="button"
								class="add-btn"
								onclick={() => (nestedEdit = { kind: 'schema', key: group.key, fields: group.fields })}
							>
								Edit…
							</button>
						{/if}
					</div>
				</div>
			{/each}

			{#if (!effectiveFields || effectiveFields.length === 0) && grouped.top.length === 0 && grouped.nested.length === 0}
				<p class="extra-hint">No pack schema fields for this element. Add extra keys below.</p>
			{/if}

			{#each extraEntries as entry (entry.key)}
				<div class="field extra-row">
					<label class="field-label" for="extra-{elementId}-{entry.key}">{entry.key}</label>
					{#if readonly}
						<div class="read-only-field" id="extra-{elementId}-{entry.key}">{entry.value}</div>
					{:else if entry.nested}
						<div class="nested-preview">
							<code class="preview-text">{entry.value}</code>
							<button
								type="button"
								class="add-btn"
								onclick={() => (nestedEdit = { kind: 'extra', key: entry.key, raw: entry.raw })}
							>
								Edit…
							</button>
							<button
								type="button"
								class="remove-btn"
								onclick={() => handleRemoveExtra(entry.key)}
								aria-label="Remove {entry.key}"
							>
								×
							</button>
						</div>
					{:else}
						<div class="extra-edit">
							<input
								id="extra-{elementId}-{entry.key}"
								class="field-input"
								type="text"
								value={entry.value}
								oninput={(e) =>
									handleExtraValue(entry.key, (e.currentTarget as HTMLInputElement).value)}
								aria-label={entry.key}
							/>
							<button
								type="button"
								class="remove-btn"
								onclick={() => handleRemoveExtra(entry.key)}
								aria-label="Remove {entry.key}"
							>
								×
							</button>
						</div>
					{/if}
				</div>
			{/each}

			{#if !readonly && onCommit}
				<div class="extra-add">
					<input class="field-input" bind:value={extraKey} placeholder="key" aria-label="Extra metadata key" />
					<input class="field-input" bind:value={extraValue} placeholder="value or JSON" aria-label="Extra metadata value" />
					<button type="button" class="add-btn" onclick={handleAddExtra} disabled={!extraKey.trim()}>
						Add
					</button>
				</div>
				{#if extraError}
					<p class="extra-error">{extraError}</p>
				{/if}
			{/if}
		</div>
	</div>

{#if nestedEdit}
	<NestedMetadataDialog
		title={nestedEdit.kind === 'schema' ? `Edit ${nestedEdit.key}` : `Edit ${nestedEdit.key}`}
		fields={nestedEdit.kind === 'schema' ? nestedEdit.fields : null}
		{metadata}
		rawKey={nestedEdit.kind === 'extra' ? nestedEdit.key : ''}
		rawValue={nestedEdit.kind === 'extra' ? nestedEdit.raw : null}
		onconfirm={(next) => {
			commitExtra(next);
			nestedEdit = null;
		}}
		oncancel={() => (nestedEdit = null)}
	/>
{/if}

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

	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
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

	.required {
		color: #ef4444;
		margin-left: 2px;
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
	}

	:global(.dark) .read-only-field {
		background: #0f1320;
		border-color: #334155;
		color: #64748b;
	}

	.field-input,
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
	}

	.field-input:focus,
	.field-select:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .field-input,
	:global(.dark) .field-select {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	.extra-hint,
	.extra-error {
		margin: 0;
		font-size: 11px;
		color: #64748b;
	}
	.extra-error {
		color: #b91c1c;
	}
	.extra-edit,
	.extra-add,
	.nested-preview {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.preview-text {
		flex: 1;
		min-width: 0;
		font-size: 11px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.remove-btn,
	.add-btn {
		height: 32px;
		padding: 0 8px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		font-size: 12px;
	}
	.remove-btn {
		color: #b91c1c;
	}
</style>
