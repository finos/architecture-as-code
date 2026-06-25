<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  C4Breadcrumb.svelte — Breadcrumb navigation bar for C4 drill-down path.

  Purely presentational — no store imports. Receives all data via props.
  Renders "All Systems > [node label] > ..." with clickable segments.
  The last segment is the current location and is NOT clickable.
  Shows a level badge pill on the right side.

  Background tint per level:
    context   → neutral  (#fafafa / dark #111827)
    container → light blue (#f8faff / dark #0d1b2e)
    component → light green (#f8fff8 / dark #0d1f0d)
-->

<script lang="ts">
	let {
		level,
		drillStack = [],
		onnavigate,
		levelBadge,
		rootLabel = 'All Systems',
		oneditdocument,
	}: {
		/** Current C4 level: 'context' | 'container' | 'component' */
		level: string;
		/** Current drill-down path — each entry is { nodeId, label }. */
		drillStack?: { nodeId: string; label: string }[];
		/** Called when a breadcrumb segment is clicked. index=0 = root. */
		onnavigate?: (index: number) => void;
		/** Badge label to display on the right (e.g. "Context", "Container", "Component"). */
		levelBadge?: string;
		/** Label for the root segment (within-doc: "All Systems"; doc trail: the context document). */
		rootLabel?: string;
		/** When set, shows an "Edit this layer" action that opens the current document for editing. */
		oneditdocument?: () => void;
	} = $props();

	/**
	 * All breadcrumb segments to render.
	 * Index 0 = root. Subsequent entries from drillStack.
	 * The last segment is the current location (not clickable).
	 */
	const segments = $derived([
		{ label: rootLabel, index: 0 },
		...drillStack.map((entry, i) => ({ label: entry.label, index: i + 1 })),
	]);
</script>

<div
	class="c4-breadcrumb"
	class:level-context={level === 'context'}
	class:level-container={level === 'container'}
	class:level-component={level === 'component'}
	role="navigation"
	aria-label="C4 navigation path"
>
	<!-- Breadcrumb trail -->
	<div class="breadcrumb-trail">
		{#each segments as seg, i}
			{#if i > 0}
				<span class="breadcrumb-sep" aria-hidden="true"> &rsaquo; </span>
			{/if}

			{#if i < segments.length - 1}
				<!-- Clickable segment (not the last / current) -->
				<button
					type="button"
					class="breadcrumb-link"
					onclick={() => onnavigate?.(seg.index)}
					title="Navigate to {seg.label}"
				>
					{seg.label}
				</button>
			{:else}
				<!-- Current location — not clickable -->
				<span class="breadcrumb-current" aria-current="page">{seg.label}</span>
			{/if}
		{/each}
	</div>

	<div class="c4-right">
		{#if oneditdocument}
			<button
				type="button"
				class="edit-doc"
				onclick={oneditdocument}
				title="Open this document to edit and apply governance"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="M12 20h9" stroke-linecap="round" />
					<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Edit this layer
			</button>
		{/if}
		<!-- Level badge pill -->
		{#if levelBadge}
			<span class="c4-level-badge" aria-label="C4 level: {levelBadge}">{levelBadge}</span>
		{/if}
	</div>
</div>

<style>
	/* ─── Container ──────────────────────────────────────────────────── */

	.c4-breadcrumb {
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		border-bottom: 1px solid var(--color-border, #e2e8f0);
		background: #fafafa;
		flex-shrink: 0;
		z-index: 10;
		position: relative;
	}

	/* Per-level background tints */
	.c4-breadcrumb.level-context {
		background: #fafafa;
	}

	.c4-breadcrumb.level-container {
		background: #f8faff;
	}

	.c4-breadcrumb.level-component {
		background: #f8fff8;
	}

	:global(.dark) .c4-breadcrumb {
		border-color: #1e293b;
		background: #111827;
	}

	:global(.dark) .c4-breadcrumb.level-context {
		background: #111827;
	}

	:global(.dark) .c4-breadcrumb.level-container {
		background: #0d1b2e;
	}

	:global(.dark) .c4-breadcrumb.level-component {
		background: #0d1f0d;
	}

	/* ─── Trail ──────────────────────────────────────────────────────── */

	.breadcrumb-trail {
		display: flex;
		align-items: center;
		font-size: 12px;
		color: var(--color-text-secondary, #64748b);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		min-width: 0;
	}

	:global(.dark) .breadcrumb-trail {
		color: #64748b;
	}

	/* ─── Separator ──────────────────────────────────────────────────── */

	.breadcrumb-sep {
		opacity: 0.4;
		margin: 0 2px;
		flex-shrink: 0;
	}

	/* ─── Clickable link segment ─────────────────────────────────────── */

	.breadcrumb-link {
		background: none;
		border: none;
		padding: 0;
		font-size: 12px;
		font-family: var(--font-sans);
		color: var(--color-accent, #3b82f6);
		cursor: pointer;
		text-decoration: none;
		flex-shrink: 0;
		transition: text-decoration 0.1s;
	}

	.breadcrumb-link:hover {
		text-decoration: underline;
	}

	:global(.dark) .breadcrumb-link {
		color: #60a5fa;
	}

	/* ─── Current (last) segment ─────────────────────────────────────── */

	.breadcrumb-current {
		font-size: 12px;
		color: var(--color-text-primary, #1e293b);
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex-shrink: 1;
		min-width: 0;
	}

	:global(.dark) .breadcrumb-current {
		color: #e2e8f0;
	}

	/* ─── Right-side group (edit action + level badge) ───────────────── */

	.c4-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.edit-doc {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 5px;
		border: 1px solid var(--color-accent, #6366f1);
		background: none;
		color: var(--color-accent, #6366f1);
		cursor: pointer;
	}
	.edit-doc:hover {
		background: rgba(99, 102, 241, 0.1);
	}

	/* ─── Level badge pill ───────────────────────────────────────────── */

	.c4-level-badge {
		font-size: 10px;
		padding: 1px 8px;
		border-radius: 10px;
		background: var(--badge-bg, #e2e8f0);
		color: var(--badge-color, #475569);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
		font-family: var(--font-sans);
		flex-shrink: 0;
		margin-left: 8px;
	}

	:global(.dark) .c4-level-badge {
		background: #1e293b;
		color: #94a3b8;
	}
</style>
