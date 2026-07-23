<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  MetadataForm.svelte — Schema-driven editor for CALM `metadata` (nodes and relationships).
-->
<script lang="ts">
	import {
		readMetadataPath,
		writeMetadataPath,
		type MetadataFieldDescriptor,
	} from '$lib/metadata/metadataForm';
	import { writeArchimateRelationshipMetadata } from '$lib/metadata/relationshipVariantSync';

	let {
		elementId,
		fields = null,
		metadata = {},
		fallbackValues = {},
		readonly = false,
		autoBindCalmCoreVariant = false,
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
		onBeforeFirstEdit?: () => void;
		onCommit?: (next: Record<string, unknown>) => void;
	} = $props();

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let firstEditSignaled = $state(false);

	$effect(() => {
		const _ = elementId;
		firstEditSignaled = false;
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
</script>

{#if fields && fields.length > 0}
	<div class="section">
		<div class="section-header">
			<span class="section-label">Metadata</span>
		</div>

		<div class="fields">
			{#each fields as field (field.key)}
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
		</div>
	</div>
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
</style>
