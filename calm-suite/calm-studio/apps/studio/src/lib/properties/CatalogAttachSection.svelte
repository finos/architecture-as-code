<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  CatalogAttachSection.svelte — a foldable inspector section for attaching a
  Gemara catalog (Requirements = control catalog, or Guidance = guidance
  catalog) to an element. Lists the attached catalogs as first-class cards and
  opens the catalog picker (grc.store + Paste) to attach more.

  Attachments are `gemara-link` decorators filtered by `data.artifact`, scoped to
  the element via `applies-to`.
-->
<script lang="ts">
	import {
		gemaraLinksForElement,
		mergeDecoratorAppliesTo,
		type CalmDecorator,
		type GemaraArtifactKind,
	} from '@calmstudio/calm-core';
	import { getModel, upsertDecorator, removeDecoratorFromElement } from '$lib/stores/calmModel.svelte';
	import { SHOW_VERIFICATION_STATUS } from '$lib/governance/verification';
	import GemaraCatalogPicker from './GemaraCatalogPicker.svelte';

	let {
		elementId,
		artifact,
		label,
		onmutate,
	}: {
		elementId: string;
		artifact: GemaraArtifactKind;
		label: string;
		onmutate?: () => void;
	} = $props();

	const readonly = $derived(!onmutate);

	let sectionExpanded = $state(false);
	let pickerOpen = $state(false);

	const links = $derived(
		gemaraLinksForElement(getModel().decorators, elementId).filter((l) => l.artifact === artifact),
	);
	const count = $derived(links.length);

	function handleRemove(uniqueId: string) {
		removeDecoratorFromElement(uniqueId, elementId);
		onmutate?.();
	}

	function handleAttached(decorators: CalmDecorator[]) {
		const existing = getModel().decorators ?? [];
		for (const d of decorators) {
			const prior = existing.find((e) => e['unique-id'] === d['unique-id']);
			upsertDecorator(mergeDecoratorAppliesTo(prior, d));
		}
		pickerOpen = false;
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
		<span class="section-label">{label}</span>
		{#if count > 0}<span class="badge">{count}</span>{/if}
	</button>

	{#if sectionExpanded}
		<div class="body">
			{#if links.length === 0}
				<p class="empty-hint">Nothing attached</p>
			{:else}
				<div class="link-list">
					{#each links as link (link.uniqueId)}
						<div class="link-card">
							<div class="link-main">
								<div class="link-top">
									<span class="link-id">{link.catalog.title ?? link.catalog.id}</span>
									{#if SHOW_VERIFICATION_STATUS && !link.verified}
										<span class="unverified-pill" title="Fetched client-side without provenance verification">unverified</span>
									{/if}
								</div>
								<span class="link-coord">{link.catalog.namespace ? link.catalog.namespace + '/' : ''}{link.catalog.id}@{link.catalog.version}</span>
							</div>
							<div class="link-actions">
								{#if link.catalog['hub-url']}
									<a
										href={link.catalog['hub-url']}
										target="_blank"
										rel="noopener noreferrer"
										class="hub-link"
										title="Open on grc.store"
										aria-label="Open catalog on grc.store"
									>
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
											<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
											<polyline points="15 3 21 3 21 9" />
											<line x1="10" y1="14" x2="21" y2="3" />
										</svg>
									</a>
								{/if}
								{#if !readonly}
									<button type="button" class="remove-btn" onclick={() => handleRemove(link.uniqueId)} aria-label="Remove {label} {link.catalog.id}" title="Remove">
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
											<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
										</svg>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if !readonly}
				<button type="button" class="add-btn" onclick={() => (pickerOpen = true)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Attach {label}
				</button>
			{/if}
		</div>
	{/if}
</div>

{#if pickerOpen}
	<GemaraCatalogPicker {elementId} {artifact} onbind={handleAttached} oncancel={() => (pickerOpen = false)} />
{/if}

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

	.link-main {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.link-top {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.link-id {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-primary, #1e293b);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.dark) .link-id {
		color: #e2e8f0;
	}

	.unverified-pill {
		font-size: 9px;
		font-weight: 600;
		padding: 1px 5px;
		border-radius: 4px;
		background: rgba(180, 83, 9, 0.12);
		color: #b45309;
	}

	:global(.dark) .unverified-pill {
		color: #fbbf24;
		background: rgba(251, 191, 36, 0.12);
	}

	.link-coord {
		font-size: 10px;
		font-family: var(--font-mono, monospace);
		color: var(--color-text-tertiary, #94a3b8);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.link-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.hub-link {
		display: flex;
		align-items: center;
		color: var(--color-text-tertiary, #94a3b8);
		text-decoration: none;
		padding: 2px;
	}

	.hub-link:hover {
		color: var(--color-accent, #6366f1);
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
		transition: all 0.15s;
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
		transition: all 0.15s;
		opacity: 0.75;
		margin-top: 4px;
	}

	.add-btn:hover {
		opacity: 1;
		background: var(--color-accent-subtle, rgba(99, 102, 241, 0.06));
	}

	:global(.dark) .add-btn {
		color: #818cf8;
		border-color: #818cf8;
	}

	.add-btn svg {
		width: 12px;
		height: 12px;
	}
</style>
