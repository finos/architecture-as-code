<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  GemaraSections.svelte — the "Decorators" area of the inspector for an element
  (a node, a relationship, or the whole architecture). This is now scoped to
  free-form CALM decorators only — Gemara guidance and control attachments are
  managed in the Governance tab (the connected AIGF + CCC flow), so they are no
  longer duplicated here.
-->
<script lang="ts">
	import DecoratorSection from './DecoratorSection.svelte';
	import { getModel } from '$lib/stores/calmModel.svelte';
	import { isGemaraDecorator } from '@calmstudio/calm-core';

	let {
		elementId,
		onmutate,
	}: {
		elementId: string;
		onmutate?: () => void;
	} = $props();

	let expanded = $state(false);

	// Custom (non-Gemara) decorators bound to this element — Gemara links live in
	// the Governance tab.
	const total = $derived(
		(getModel().decorators ?? []).filter(
			(d) => d['applies-to'].includes(elementId) && !isGemaraDecorator(d),
		).length,
	);
</script>

<div class="group">
	<button type="button" class="group-toggle" onclick={() => (expanded = !expanded)} aria-expanded={expanded}>
		<span class="chevron" class:open={expanded}>
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
				<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
		<span class="group-label">Decorators</span>
		{#if total > 0}<span class="badge">{total}</span>{/if}
	</button>

	{#if expanded}
		<div class="group-body">
			<DecoratorSection {elementId} {onmutate} />
		</div>
	{/if}
</div>

<style>
	.group {
		border-top: 1px solid var(--color-border, #e2e8f0);
	}

	:global(.dark) .group {
		border-color: #1e293b;
	}

	.group-toggle {
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

	.group-toggle:hover {
		background: var(--color-surface-secondary, #f8fafc);
	}

	:global(.dark) .group-toggle:hover {
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

	.group-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-secondary, #64748b);
		flex: 1;
	}

	:global(.dark) .group-label {
		color: #94a3b8;
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

	/* Nest the sub-sections under the group with a subtle indent. */
	.group-body {
		padding-left: 10px;
	}
</style>
