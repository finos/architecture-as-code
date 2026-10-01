<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  ArrayPropertyEditor — inline row-per-element editor for JSON arrays (R86).
  Local draft updates immediately on Add/Remove; parent values sync only when they change.
-->
<script lang="ts">
	import type { MetadataFieldDescriptor } from '$lib/metadata/metadataForm';
	import { formatJsonPretty, readMetadataPath, writeMetadataPath } from '$lib/metadata/metadataForm';

	let {
		values = [],
		itemKind = 'string',
		itemEnumValues,
		itemFields,
		readonly = false,
		idPrefix = 'arr',
		onchange,
	}: {
		values?: unknown[];
		itemKind?: 'string' | 'enum' | 'object';
		itemEnumValues?: string[];
		itemFields?: MetadataFieldDescriptor[];
		readonly?: boolean;
		idPrefix?: string;
		onchange?: (next: unknown[]) => void;
	} = $props();

	function cloneList(list: unknown[] | undefined): unknown[] {
		return Array.isArray(list) ? [...list] : [];
	}

	function serialize(list: unknown[]): string {
		try {
			return JSON.stringify(list);
		} catch {
			return '[]';
		}
	}

	let draft = $state<unknown[]>(cloneList(values));
	/** Last `values` prop we applied — ignore echo misses so Add keeps the new row. */
	let appliedValuesJson = $state(serialize(cloneList(values)));

	$effect(() => {
		const incoming = cloneList(values);
		const json = serialize(incoming);
		if (json === appliedValuesJson) return;
		appliedValuesJson = json;
		draft = incoming;
	});

	function commit(next: unknown[]) {
		if (readonly) return;
		draft = next;
		onchange?.(next);
	}

	function updateAt(index: number, value: unknown) {
		const next = [...draft];
		next[index] = value;
		commit(next);
	}

	function removeAt(index: number) {
		commit(draft.filter((_, i) => i !== index));
	}

	function blankItem(): unknown {
		if (itemKind === 'object') {
			const blank: Record<string, unknown> = {};
			if (itemFields?.length) {
				for (const f of itemFields) {
					if (f.path.length === 1) blank[f.path[0]!] = '';
				}
			}
			return blank;
		}
		return '';
	}

	function addItem() {
		commit([...draft, blankItem()]);
	}

	function primitiveDisplay(value: unknown): string {
		if (value == null) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		return formatJsonPretty(value);
	}

	function objectAsRecord(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	}

	function updateObjectField(index: number, field: MetadataFieldDescriptor, text: string) {
		const base = objectAsRecord(draft[index]);
		updateAt(index, writeMetadataPath(base, field.path, text));
	}

	function updateObjectJson(index: number, text: string) {
		try {
			updateAt(index, JSON.parse(text));
		} catch {
			/* keep typing until valid — commit only valid JSON */
		}
	}
</script>

<div class="array-editor" role="group" aria-label="Array values">
	{#if draft.length === 0}
		<p class="empty">No items — click Add to create a row</p>
	{/if}
	{#each draft as item, index (index)}
		<div class="row">
			<span class="index" aria-hidden="true">[{index}]</span>
			{#if readonly}
				{#if itemKind === 'object'}
					<pre class="pretty" id="{idPrefix}-{index}">{formatJsonPretty(item)}</pre>
				{:else}
					<div class="read-only" id="{idPrefix}-{index}">{primitiveDisplay(item) || '—'}</div>
				{/if}
			{:else if itemKind === 'enum' && itemEnumValues}
				<select
					id="{idPrefix}-{index}"
					class="control"
					value={primitiveDisplay(item)}
					onchange={(e) => updateAt(index, (e.currentTarget as HTMLSelectElement).value)}
					aria-label="Item {index}"
				>
					<option value="">—</option>
					{#each itemEnumValues as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
			{:else if itemKind === 'object'}
				{#if itemFields && itemFields.length > 0}
					<div class="object-fields">
						{#each itemFields as field (field.key)}
							{@const rec = objectAsRecord(item)}
							<label class="mini-label" for="{idPrefix}-{index}-{field.key}">{field.label}</label>
							{#if field.kind === 'enum' && field.enumValues}
								<select
									id="{idPrefix}-{index}-{field.key}"
									class="control"
									value={readMetadataPath(rec, field.path)}
									onchange={(e) =>
										updateObjectField(index, field, (e.currentTarget as HTMLSelectElement).value)}
								>
									<option value="">—</option>
									{#each field.enumValues as option}
										<option value={option}>{option}</option>
									{/each}
								</select>
							{:else}
								<input
									id="{idPrefix}-{index}-{field.key}"
									class="control"
									type="text"
									value={readMetadataPath(rec, field.path)}
									oninput={(e) =>
										updateObjectField(index, field, (e.currentTarget as HTMLInputElement).value)}
								/>
							{/if}
						{/each}
					</div>
				{:else}
					<textarea
						id="{idPrefix}-{index}"
						class="pretty-input"
						value={formatJsonPretty(item === undefined ? {} : item)}
						aria-label="Item {index} JSON"
						oninput={(e) => updateObjectJson(index, (e.currentTarget as HTMLTextAreaElement).value)}
					></textarea>
				{/if}
			{:else}
				<input
					id="{idPrefix}-{index}"
					class="control"
					type="text"
					value={primitiveDisplay(item)}
					placeholder="value"
					aria-label="Item {index}"
					oninput={(e) => updateAt(index, (e.currentTarget as HTMLInputElement).value)}
				/>
			{/if}
			{#if !readonly}
				<button
					type="button"
					class="remove"
					onclick={() => removeAt(index)}
					aria-label="Remove item {index}"
				>
					−
				</button>
			{/if}
		</div>
	{/each}
	{#if !readonly}
		<button type="button" class="add" onclick={addItem}>Add</button>
	{/if}
</div>

<style>
	.array-editor {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.empty {
		margin: 0;
		font-size: 11px;
		color: #64748b;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
	}
	.index {
		font-size: 10px;
		font-family: var(--font-mono, monospace);
		color: #94a3b8;
		padding-top: 8px;
		min-width: 28px;
	}
	.control,
	.read-only {
		flex: 1;
		min-width: 0;
		height: 32px;
		padding: 0 8px;
		font-size: 12px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: var(--color-surface, #fff);
		color: var(--color-text-primary, #1e293b);
	}
	.read-only {
		display: flex;
		align-items: center;
		color: #64748b;
		background: #f8fafc;
	}
	.pretty,
	.pretty-input {
		flex: 1;
		min-width: 0;
		margin: 0;
		padding: 8px;
		font-size: 11px;
		font-family: var(--font-mono, monospace);
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: #f8fafc;
		max-height: 160px;
		overflow: auto;
	}
	.pretty-input {
		background: var(--color-surface, #fff);
		resize: vertical;
		min-height: 72px;
	}
	.object-fields {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.mini-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		color: #94a3b8;
	}
	.remove,
	.add {
		height: 32px;
		padding: 0 10px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: #fff;
		cursor: pointer;
		font-size: 12px;
	}
	.remove {
		color: #b91c1c;
	}
	.add {
		align-self: flex-start;
	}
</style>
