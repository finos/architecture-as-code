<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  DocumentDecorators.svelte — document-scoped decorator panel for the right
  sidebar. Lists EVERY decorator that applies to the currently-shown document
  (re-scopes when the shown document changes — open file or C4 drill), and lets
  the user author/remove plain CALM decorators against the document's elements.

  Editing operates on the canonical model store, so it is only enabled for the
  editable document (readonly in C4 read-only views, which just list).
-->
<script lang="ts">
	import type { CalmArchitecture, CalmDecorator } from '@calmstudio/calm-core';
	import { isGemaraDecorator, GEMARA_ARCHITECTURE_SCOPE } from '@calmstudio/calm-core';
	import { upsertDecorator, removeDecorator } from '$lib/stores/calmModel.svelte';
	import { parseDecoratorData } from '$lib/decorators/decoratorForm';
	import { nanoid } from 'nanoid';

	let {
		architecture,
		readonly = false,
		onmutate,
	}: {
		/** The document currently shown (editable model, or a C4-drilled doc). */
		architecture: CalmArchitecture;
		/** Read-only listing (C4 drill view) — hides the add/remove affordances. */
		readonly?: boolean;
		/** Called after a mutation so the host can re-project canvas / code panel. */
		onmutate?: () => void;
	} = $props();

	// Gemara-link decorators (linked control/guidance catalogs) are managed in the
	// Governance section above — listing them here too would double-show the same
	// catalog. This panel owns only the free-form/custom decorators, mirroring the
	// per-element DecoratorSection.
	const decorators = $derived((architecture.decorators ?? []).filter((d) => !isGemaraDecorator(d)));
	const nodes = $derived(architecture.nodes ?? []);

	/** Resolve an applies-to id to a human label (node name, or the arch sentinel). */
	function labelFor(id: string): string {
		if (id === GEMARA_ARCHITECTURE_SCOPE) return 'Whole document';
		return nodes.find((n) => n['unique-id'] === id)?.name ?? id;
	}

	let adding = $state(false);
	let newType = $state('');
	let newData = $state('{}');
	let newAppliesTo = $state<string[]>([GEMARA_ARCHITECTURE_SCOPE]);
	let addError = $state<string | null>(null);

	function resetForm() {
		adding = false;
		newType = '';
		newData = '{}';
		newAppliesTo = [GEMARA_ARCHITECTURE_SCOPE];
		addError = null;
	}

	function toggleAppliesTo(id: string) {
		newAppliesTo = newAppliesTo.includes(id)
			? newAppliesTo.filter((x) => x !== id)
			: [...newAppliesTo, id];
	}

	function handleAdd() {
		addError = null;
		const type = newType.trim();
		if (!type) {
			addError = 'Type is required';
			return;
		}
		if (newAppliesTo.length === 0) {
			addError = 'Select at least one element to apply to';
			return;
		}
		const { data, error } = parseDecoratorData(newData);
		if (error) {
			addError = error;
			return;
		}
		upsertDecorator({
			'unique-id': nanoid(),
			type,
			// Stamped to the real filename on save; placeholder until then.
			target: ['architecture.json'],
			'applies-to': [...newAppliesTo],
			data: data!,
		});
		resetForm();
		onmutate?.();
	}

	function handleRemove(uniqueId: string) {
		removeDecorator(uniqueId);
		onmutate?.();
	}
</script>

<section class="doc-decorators" aria-label="Document decorators">
	<div class="dd-header">
		<span class="dd-title">Decorators</span>
		<span class="dd-count">{decorators.length}</span>
	</div>

	{#if decorators.length === 0}
		<p class="empty-hint">No custom decorators on this document</p>
	{:else}
		<div class="link-list">
			{#each decorators as d (d['unique-id'])}
				<div class="link-card">
					<div class="card-main">
						<span class="dec-type">{d.type}</span>
						<div class="chips">
							{#each d['applies-to'] as id}
								<span class="chip" title={id}>{labelFor(id)}</span>
							{/each}
						</div>
					</div>
					{#if !readonly}
						<button type="button" class="remove-btn" onclick={() => handleRemove(d['unique-id'])} aria-label="Remove decorator {d.type}" title="Remove">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
								<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
							</svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	{#if !readonly}
		{#if adding}
			<div class="add-form">
				<label class="field">
					<span class="field-label">Type</span>
					<input class="text-input" bind:value={newType} placeholder="e.g. threat-model" aria-label="Decorator type" />
				</label>
				<div class="field">
					<span class="field-label">Applies to</span>
					<div class="applies-list">
						<label class="applies-item">
							<input
								type="checkbox"
								checked={newAppliesTo.includes(GEMARA_ARCHITECTURE_SCOPE)}
								onchange={() => toggleAppliesTo(GEMARA_ARCHITECTURE_SCOPE)}
							/>
							<span>Whole document</span>
						</label>
						{#each nodes as n (n['unique-id'])}
							<label class="applies-item">
								<input
									type="checkbox"
									checked={newAppliesTo.includes(n['unique-id'])}
									onchange={() => toggleAppliesTo(n['unique-id'])}
								/>
								<span>{n.name ?? n['unique-id']}</span>
							</label>
						{/each}
					</div>
				</div>
				<label class="field">
					<span class="field-label">Data (JSON)</span>
					<textarea class="text-input data-area" rows={3} bind:value={newData} aria-label="Decorator data"></textarea>
				</label>
				{#if addError}<p class="error" role="alert">{addError}</p>{/if}
				<div class="form-actions">
					<button type="button" class="secondary-btn" onclick={resetForm}>Cancel</button>
					<button type="button" class="primary-btn" onclick={handleAdd}>Add</button>
				</div>
			</div>
		{:else}
			<button type="button" class="add-btn" onclick={() => (adding = true)}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				Add decorator
			</button>
		{/if}
	{/if}
</section>

<style>
	.doc-decorators {
		padding: 4px 12px 12px;
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .doc-decorators {
		border-color: #1e293b;
	}

	.dd-header {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 0 6px;
	}

	.dd-title {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary, #94a3b8);
		flex: 1;
	}

	.dd-count {
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

	.link-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 6px;
	}

	.link-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 6px;
		padding: 7px 8px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 6px;
		background: var(--color-surface, #fff);
	}

	:global(.dark) .link-card {
		border-color: #334155;
		background: #111827;
	}

	.card-main {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.dec-type {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-primary, #1e293b);
	}

	:global(.dark) .dec-type {
		color: #e2e8f0;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.chip {
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 8px;
		background: var(--color-surface-secondary, #f1f5f9);
		color: var(--color-text-secondary, #64748b);
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.dark) .chip {
		background: #1e293b;
		color: #cbd5e1;
	}

	.remove-btn {
		flex-shrink: 0;
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--color-text-tertiary, #94a3b8);
		border-radius: 3px;
		padding: 1px;
	}

	.remove-btn:hover {
		color: #ef4444;
		background: rgba(239, 68, 68, 0.08);
	}

	.empty-hint {
		font-size: 11px;
		color: var(--color-text-tertiary, #94a3b8);
		margin: 0 0 6px;
		font-style: italic;
	}

	.add-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 4px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.field-label {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-tertiary, #94a3b8);
	}

	.applies-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 120px;
		overflow-y: auto;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		padding: 4px 6px;
	}

	:global(.dark) .applies-list {
		border-color: #334155;
	}

	.applies-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: var(--color-text-primary, #1e293b);
	}

	:global(.dark) .applies-item {
		color: #e2e8f0;
	}

	.text-input {
		padding: 5px 7px;
		font-size: 11px;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-primary, #1e293b);
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		outline: none;
	}

	.text-input:focus {
		border-color: var(--color-accent, #6366f1);
	}

	:global(.dark) .text-input {
		background: #1e293b;
		border-color: #334155;
		color: #e2e8f0;
	}

	.data-area {
		resize: vertical;
		line-height: 1.4;
	}

	.error {
		margin: 0;
		font-size: 11px;
		color: #ef4444;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
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
		opacity: 0.75;
		margin-top: 4px;
	}

	.add-btn:hover {
		opacity: 1;
	}

	.add-btn svg {
		width: 12px;
		height: 12px;
	}

	.primary-btn {
		padding: 5px 12px;
		font-size: 11px;
		font-weight: 600;
		color: #fff;
		background: var(--color-accent, #6366f1);
		border: none;
		border-radius: 5px;
		cursor: pointer;
	}

	.secondary-btn {
		padding: 5px 12px;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary, #475569);
		background: none;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 5px;
		cursor: pointer;
	}

	:global(.dark) .secondary-btn {
		color: #cbd5e1;
		border-color: #334155;
	}
</style>
