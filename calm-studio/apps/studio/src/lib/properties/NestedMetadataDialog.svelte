<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<script lang="ts">
	import {
		readMetadataPath,
		readMetadataValue,
		writeMetadataPath,
		writeMetadataValue,
		formatJsonPretty,
		cloneJson,
		type MetadataFieldDescriptor,
	} from '$lib/metadata/metadataForm';
	import ArrayPropertyEditor from './ArrayPropertyEditor.svelte';

	let {
		title,
		fields = null,
		metadata,
		rawKey = '',
		rawValue = null,
		onconfirm,
		oncancel,
	}: {
		title: string;
		fields?: MetadataFieldDescriptor[] | null;
		metadata: Record<string, unknown>;
		rawKey?: string;
		rawValue?: unknown;
		onconfirm: (next: Record<string, unknown>) => void;
		oncancel: () => void;
	} = $props();

	/* Dialog is created per open; capture the starting values once (JSON clone — Svelte proxies). */
	let draft = $state<Record<string, unknown>>(cloneJson(metadata ?? {}));
	let rawDraft = $state(
		rawValue === undefined || rawValue === null
			? '{}'
			: typeof rawValue === 'string'
				? rawValue
				: formatJsonPretty(rawValue)
	);
	let error = $state<string | null>(null);

	function setField(field: MetadataFieldDescriptor, value: string) {
		draft = writeMetadataPath(draft, field.path, value);
	}

	function setArrayField(field: MetadataFieldDescriptor, next: unknown[]) {
		draft = writeMetadataValue(draft, field.path, next);
	}

	function isArrayField(field: MetadataFieldDescriptor): boolean {
		if (field.kind === 'array') return true;
		return Array.isArray(readMetadataValue(draft, field.path));
	}

	function submit() {
		error = null;
		if (fields?.length) {
			onconfirm(draft);
			return;
		}
		try {
			const parsed: unknown = JSON.parse(rawDraft);
			onconfirm({ ...metadata, [rawKey]: parsed });
		} catch {
			error = 'Nested value must be valid JSON';
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
	<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="nested-meta-title">
		<h2 id="nested-meta-title" class="title">{title}</h2>
		{#if fields?.length}
			<div class="fields">
				{#each fields as field (field.key)}
					{@const value = readMetadataPath(draft, field.path)}
					{@const raw = readMetadataValue(draft, field.path)}
					<label class="field-label" for="nested-{field.key}">
						{field.label}
						{#if field.required}<span class="required">*</span>{/if}
					</label>
					{#if isArrayField(field)}
						<ArrayPropertyEditor
							idPrefix="nested-{field.key}"
							values={Array.isArray(raw) ? raw : []}
							itemKind={field.itemKind ?? 'string'}
							itemEnumValues={field.itemEnumValues}
							itemFields={field.itemFields}
							onchange={(next) => setArrayField(field, next)}
						/>
					{:else if field.kind === 'enum' && field.enumValues}
						<select
							id="nested-{field.key}"
							class="input"
							value={value}
							aria-label={field.label}
							onchange={(e) => setField(field, (e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">—</option>
							{#each field.enumValues as option}
								<option value={option}>{option}</option>
							{/each}
						</select>
					{:else}
						<input
							id="nested-{field.key}"
							class="input"
							value={value}
							oninput={(e) => setField(field, (e.currentTarget as HTMLInputElement).value)}
						/>
					{/if}
				{/each}
			</div>
		{:else}
			<label class="field-label" for="nested-json">{rawKey}</label>
			<textarea id="nested-json" class="textarea" bind:value={rawDraft}></textarea>
		{/if}
		{#if error}
			<p class="error">{error}</p>
		{/if}
		<div class="actions">
			<button type="button" class="btn" onclick={oncancel}>Cancel</button>
			<button type="button" class="btn primary" onclick={submit}>OK</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 10050;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.45);
	}
	.dialog {
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100vh - 48px);
		overflow: auto;
		padding: 18px 20px;
		border-radius: 10px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
	}
	.title {
		margin: 0 0 12px;
		font-size: 15px;
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.field-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}
	.required {
		color: #ef4444;
	}
	.input,
	.textarea {
		width: 100%;
		padding: 7px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		font-size: 13px;
		font-family: inherit;
	}
	.textarea {
		min-height: 200px;
		font-family: var(--font-mono, monospace);
		white-space: pre;
		line-height: 1.4;
	}
	.error {
		color: #b91c1c;
		font-size: 12px;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 14px;
	}
	.btn {
		padding: 7px 14px;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #fff;
		cursor: pointer;
	}
	.btn.primary {
		background: #2563eb;
		border-color: #2563eb;
		color: #fff;
	}
</style>
