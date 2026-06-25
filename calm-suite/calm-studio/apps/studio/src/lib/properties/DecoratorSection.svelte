<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  DecoratorSection.svelte — a foldable inspector section for free-form CALM
  decorators on an element. Lists the non-Gemara decorators that apply to this
  element and lets the user author a plain CALM decorator (a `type` plus a
  free-form `data` object). Gemara catalog attachments are shown in their own
  Requirements/Guidance sections, not here.
-->
<script lang="ts">
	import { isGemaraDecorator } from '@calmstudio/calm-core';
	import { getModel, upsertDecorator, removeDecoratorFromElement } from '$lib/stores/calmModel.svelte';
	import { parseDecoratorData } from '$lib/decorators/decoratorForm';
	import { nanoid } from 'nanoid';

	let {
		elementId,
		onmutate,
	}: {
		elementId: string;
		onmutate?: () => void;
	} = $props();

	const readonly = $derived(!onmutate);

	let sectionExpanded = $state(false);
	let adding = $state(false);
	let newType = $state('');
	let newData = $state('{}');
	let addError = $state<string | null>(null);

	const decorators = $derived(
		(getModel().decorators ?? []).filter(
			(d) => !isGemaraDecorator(d) && d['applies-to'].includes(elementId),
		),
	);
	const count = $derived(decorators.length);

	function resetForm() {
		adding = false;
		newType = '';
		newData = '{}';
		addError = null;
	}

	function handleAdd() {
		addError = null;
		const type = newType.trim();
		if (!type) {
			addError = 'Type is required';
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
			target: ['architecture.json'],
			'applies-to': [elementId],
			data: data!,
		});
		resetForm();
		onmutate?.();
	}

	function handleRemove(uniqueId: string) {
		removeDecoratorFromElement(uniqueId, elementId);
		onmutate?.();
	}
</script>

<div class="section">
	<button type="button" class="section-toggle" onclick={() => (sectionExpanded = !sectionExpanded)} aria-expanded={sectionExpanded}>
		<span class="chevron" class:open={sectionExpanded}>
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
				<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
		<span class="section-label">Custom</span>
		{#if count > 0}<span class="badge">{count}</span>{/if}
	</button>

	{#if sectionExpanded}
		<div class="body">
			{#if decorators.length === 0}
				<p class="empty-hint">No custom decorators</p>
			{:else}
				<div class="link-list">
					{#each decorators as d (d['unique-id'])}
						<div class="link-card">
							<span class="dec-type">{d.type}</span>
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
		</div>
	{/if}
</div>

<style>
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

	.body {
		padding: 0 12px 10px;
	}

	.link-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 6px;
	}

	.link-card {
		display: flex;
		align-items: center;
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

	.dec-type {
		font-size: 11px;
		font-weight: 600;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-primary, #1e293b);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.dark) .dec-type {
		color: #e2e8f0;
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
