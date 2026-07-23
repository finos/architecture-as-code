<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  TemplatePicker.svelte — Full-screen modal for selecting architecture templates.

  Layout: Fixed overlay with backdrop blur for maximum visual impact at demos.
  - Top: title + close button
  - Below title: category tabs (FluxNova, AI Governance, General, ...)
  - Body: responsive grid of template cards (2-3 columns desktop, 1 mobile)
  - Each card: colored dot, template name, description, tag pills, node count badge
  - Clicking a card fires onselect(templateId)
  - Cancel / Escape / backdrop click fire oncancel()

  Props (Svelte 5 $props):
    onselect: (id: string) => void   — template card was clicked
    oncancel: () => void             — user dismissed without selecting
-->

<script lang="ts">
	import { getTemplatesByCategory, getAllCategories, type CalmTemplate } from './registry';

	let {
		onselect,
		oncancel,
	}: {
		onselect: (id: string) => void;
		oncancel: () => void;
	} = $props();

	// ─── Category display helpers ─────────────────────────────────────────────

	/** Human-readable label for category keys */
	function categoryLabel(cat: string): string {
		const map: Record<string, string> = {
			fluxnova: 'FluxNova',
			'ai-governance': 'AI Governance',
			general: 'General',
			opengris: 'OpenGRIS',
		};
		return map[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
	}

	/** Accent color for the category dot */
	function categoryColor(cat: string): string {
		const map: Record<string, string> = {
			fluxnova: '#f97316',
			'ai-governance': '#8b5cf6',
			general: '#3b82f6',
			opengris: '#16a34a',
		};
		return map[cat] ?? '#64748b';
	}

	// ─── State ────────────────────────────────────────────────────────────────

	const categories = getAllCategories();
	let activeCategory = $state(categories[0] ?? 'fluxnova');

	const activeTemplates = $derived(getTemplatesByCategory(activeCategory));

	// ─── Keyboard handling ────────────────────────────────────────────────────

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			oncancel();
		}
	}

	// ─── Backdrop click ───────────────────────────────────────────────────────

	function handleBackdropClick(e: MouseEvent) {
		// Only close if clicked directly on the backdrop (not on modal content)
		if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
			oncancel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Template picker">
	<div class="modal-content">
		<!-- Header -->
		<div class="modal-header">
			<div class="modal-title-group">
				<h2 class="modal-title">Start from a template</h2>
				<p class="modal-subtitle">Choose an architecture template to load onto the canvas</p>
			</div>
			<button
				type="button"
				class="close-btn"
				onclick={oncancel}
				aria-label="Close template picker"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<!-- Category tabs -->
		<div class="category-tabs" role="tablist" aria-label="Template categories">
			{#each categories as cat}
				<button
					type="button"
					role="tab"
					class="category-tab"
					class:active={activeCategory === cat}
					onclick={() => (activeCategory = cat)}
					aria-selected={activeCategory === cat}
					aria-controls="template-grid"
				>
					<span class="cat-dot" style="background: {categoryColor(cat)}"></span>
					{categoryLabel(cat)}
					<span class="cat-count">{getTemplatesByCategory(cat).length}</span>
				</button>
			{/each}
		</div>

		<!-- Template grid -->
		<div class="template-grid" id="template-grid" role="tabpanel">
			{#each activeTemplates as tmpl (tmpl._template.id)}
				<button
					type="button"
					class="template-card"
					onclick={() => onselect(tmpl._template.id)}
					aria-label="Load template: {tmpl._template.name}"
				>
					<!-- Card header: dot + name + node count badge -->
					<div class="card-header">
						<span class="card-dot" style="background: {categoryColor(tmpl._template.category)}"></span>
						<span class="card-name">{tmpl._template.name}</span>
						<span class="node-badge" title="{tmpl.nodes.length} nodes">
							{tmpl.nodes.length}
						</span>
					</div>

					<!-- Description -->
					<p class="card-description">{tmpl._template.description}</p>

					<!-- Tag pills -->
					<div class="card-tags" aria-label="Tags">
						{#each tmpl._template.tags.slice(0, 4) as tag}
							<span class="tag-pill">{tag}</span>
						{/each}
					</div>
				</button>
			{/each}

			{#if activeTemplates.length === 0}
				<p class="empty-category">No templates in this category yet.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	/* ─── Backdrop ───────────────────────────────────────────────── */

	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	/* ─── Modal container ────────────────────────────────────────── */

	.modal-content {
		background: var(--color-surface, #ffffff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 16px;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
		width: 100%;
		max-width: 820px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	:global(.dark) .modal-content {
		background: #0f172a;
		border-color: #1e293b;
		box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
	}

	/* ─── Header ─────────────────────────────────────────────────── */

	.modal-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 20px 24px 16px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		flex-shrink: 0;
	}

	:global(.dark) .modal-header {
		border-color: #1e293b;
	}

	.modal-title-group {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.modal-title {
		font-size: 16px;
		font-weight: 600;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-primary, #0f172a);
		margin: 0;
	}

	:global(.dark) .modal-title {
		color: #f1f5f9;
	}

	.modal-subtitle {
		font-size: 12px;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-secondary, #64748b);
		margin: 0;
	}

	:global(.dark) .modal-subtitle {
		color: #64748b;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 1px solid var(--color-border, #e2e8f0);
		background: var(--color-surface, #ffffff);
		color: var(--color-text-secondary, #64748b);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.12s ease, color 0.12s ease;
	}

	.close-btn:hover {
		background: var(--color-surface-tertiary, #f1f5f9);
		color: var(--color-text-primary, #0f172a);
	}

	:global(.dark) .close-btn {
		background: #111827;
		border-color: #334155;
		color: #94a3b8;
	}

	:global(.dark) .close-btn:hover {
		background: #1e293b;
		color: #e2e8f0;
	}

	/* ─── Category tabs ──────────────────────────────────────────── */

	.category-tabs {
		display: flex;
		gap: 0;
		padding: 0 24px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		flex-shrink: 0;
		overflow-x: auto;
	}

	:global(.dark) .category-tabs {
		border-color: #1e293b;
	}

	.category-tab {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		border: none;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--color-text-secondary, #64748b);
		font-size: 12px;
		font-weight: 500;
		font-family: var(--font-sans, system-ui, sans-serif);
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.12s ease, border-color 0.12s ease;
		margin-bottom: -1px;
	}

	.category-tab:hover {
		color: var(--color-text-primary, #0f172a);
	}

	.category-tab.active {
		color: var(--color-accent, #f97316);
		border-bottom-color: var(--color-accent, #f97316);
	}

	:global(.dark) .category-tab {
		color: #64748b;
	}

	:global(.dark) .category-tab:hover {
		color: #e2e8f0;
	}

	:global(.dark) .category-tab.active {
		color: #fb923c;
		border-bottom-color: #fb923c;
	}

	.cat-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.cat-count {
		background: var(--color-surface-tertiary, #f1f5f9);
		color: var(--color-text-secondary, #64748b);
		font-size: 10px;
		font-weight: 600;
		padding: 1px 5px;
		border-radius: 10px;
		line-height: 1.4;
	}

	:global(.dark) .cat-count {
		background: #1e293b;
		color: #64748b;
	}

	/* ─── Template grid ──────────────────────────────────────────── */

	.template-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
		padding: 20px 24px;
		overflow-y: auto;
		flex: 1;
	}

	/* ─── Template card ──────────────────────────────────────────── */

	.template-card {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 10px;
		background: var(--color-surface, #ffffff);
		text-align: left;
		cursor: pointer;
		transition: border-color 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
	}

	.template-card:hover {
		border-color: #f97316;
		box-shadow: 0 4px 12px rgba(249, 115, 22, 0.12);
		background: var(--color-surface, #ffffff);
	}

	:global(.dark) .template-card {
		background: #111827;
		border-color: #1e293b;
	}

	:global(.dark) .template-card:hover {
		border-color: #f97316;
		box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
		background: #1a2234;
	}

	/* Card header row */

	.card-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.card-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.card-name {
		flex: 1;
		font-size: 12px;
		font-weight: 600;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-primary, #0f172a);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.dark) .card-name {
		color: #e2e8f0;
	}

	.node-badge {
		font-size: 10px;
		font-weight: 600;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-secondary, #64748b);
		background: var(--color-surface-tertiary, #f1f5f9);
		border-radius: 10px;
		padding: 1px 6px;
		flex-shrink: 0;
	}

	:global(.dark) .node-badge {
		background: #1e293b;
		color: #64748b;
	}

	/* Description */

	.card-description {
		font-size: 11px;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-secondary, #64748b);
		line-height: 1.5;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	:global(.dark) .card-description {
		color: #64748b;
	}

	/* Tag pills */

	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.tag-pill {
		font-size: 10px;
		font-family: var(--font-sans, system-ui, sans-serif);
		font-weight: 500;
		color: var(--color-text-secondary, #64748b);
		background: var(--color-surface-tertiary, #f1f5f9);
		border-radius: 10px;
		padding: 2px 7px;
		white-space: nowrap;
	}

	:global(.dark) .tag-pill {
		background: #1e293b;
		color: #64748b;
	}

	/* Empty state */

	.empty-category {
		grid-column: 1 / -1;
		text-align: center;
		font-size: 13px;
		font-family: var(--font-sans, system-ui, sans-serif);
		color: var(--color-text-secondary, #64748b);
		padding: 40px 0;
		margin: 0;
	}
</style>
