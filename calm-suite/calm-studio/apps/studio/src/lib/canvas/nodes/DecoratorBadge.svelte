<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  DecoratorBadge.svelte — a small diamond marker shown on any canvas element
  (node or relationship) that carries one or more decorators, with a hover
  quickview listing them. Reads the decorators for `elementId` straight from the
  calmModel store so it updates reactively when a decorator is attached/removed
  in the inspector (the canvas node/edge data does not carry decorators).

  Renders nothing when the element has no decorators. The parent must be
  position: relative for the badge to anchor (node/edge wrappers already are).
-->
<script lang="ts">
	import { decoratorsForElement } from '$lib/stores/calmModel.svelte';
	import { parseGemaraDecorator } from '@calmstudio/calm-core';

	let {
		elementId,
		inline = false,
	}: {
		elementId: string;
		/** When true, render in normal flow (for edge labels) instead of anchoring
		 * to a node's top-left corner. */
		inline?: boolean;
	} = $props();

	type Item = { label: string; sub: string; kind: 'requirements' | 'guidance' | 'custom' };

	const items = $derived.by<Item[]>(() =>
		decoratorsForElement(elementId).map((d) => {
			const link = parseGemaraDecorator(d);
			if (link) {
				const coord = `${link.catalog.namespace ? link.catalog.namespace + '/' : ''}${link.catalog.id}@${link.catalog.version}`;
				return {
					label: link.catalog.title ?? link.catalog.id,
					sub: `${link.artifact} · ${coord}`,
					kind: link.artifact,
				};
			}
			return { label: d.type, sub: 'custom decorator', kind: 'custom' };
		}),
	);

	const count = $derived(items.length);
	const titleText = $derived(items.map((i) => `${i.label} (${i.sub})`).join('\n'));
</script>

{#if count > 0}
	<div class="deco" class:inline title={titleText}>
		<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
			<rect x="3.2" y="3.2" width="9.6" height="9.6" rx="1.6" transform="rotate(45 8 8)" />
		</svg>
		{#if count > 1}<span class="count">{count}</span>{/if}

		<div class="quickview" role="tooltip">
			<div class="qv-head">Decorators</div>
			<ul class="qv-list">
				{#each items as item (item.label + item.sub)}
					<li class="qv-row">
						<span class="qv-dot" class:guidance={item.kind === 'guidance'} class:custom={item.kind === 'custom'}></span>
						<span class="qv-text">
							<span class="qv-label">{item.label}</span>
							<span class="qv-sub">{item.sub}</span>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	.deco {
		position: absolute;
		top: -9px;
		left: -9px;
		z-index: 11;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #6366f1;
		cursor: default;
	}

	/* Edge-label usage: sit in normal flow, centered by the EdgeLabel wrapper. */
	.deco.inline {
		position: relative;
		top: auto;
		left: auto;
	}

	.deco svg rect {
		fill: #6366f1;
		stroke: var(--color-surface, #fff);
		stroke-width: 1.4;
	}

	:global(.dark) .deco svg rect {
		stroke: #0f1320;
	}

	.count {
		position: absolute;
		top: -6px;
		left: 12px;
		min-width: 13px;
		height: 13px;
		padding: 0 3px;
		border-radius: 7px;
		background: #6366f1;
		color: #fff;
		font-family: var(--node-font, system-ui, sans-serif);
		font-size: 9px;
		font-weight: 700;
		line-height: 13px;
		text-align: center;
		border: 1.2px solid var(--color-surface, #fff);
	}

	:global(.dark) .count {
		border-color: #0f1320;
	}

	/* Quickview popover — hidden until the diamond is hovered. */
	.quickview {
		position: absolute;
		top: 18px;
		left: 0;
		z-index: 20;
		min-width: 180px;
		max-width: 260px;
		padding: 7px 9px;
		background: var(--color-surface, #fff);
		border: 1px solid var(--color-border, #e2e8f0);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
		opacity: 0;
		visibility: hidden;
		transform: translateY(-3px);
		transition: opacity 0.12s ease, transform 0.12s ease;
		pointer-events: none;
	}

	.deco:hover .quickview {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}

	:global(.dark) .quickview {
		background: #111827;
		border-color: #334155;
	}

	.qv-head {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--color-text-tertiary, #94a3b8);
		margin-bottom: 5px;
	}

	.qv-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.qv-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
	}

	.qv-dot {
		flex-shrink: 0;
		width: 7px;
		height: 7px;
		margin-top: 3px;
		border-radius: 2px;
		transform: rotate(45deg);
		background: #6366f1;
	}

	.qv-dot.guidance {
		background: #0ea5e9;
	}

	.qv-dot.custom {
		background: #94a3b8;
	}

	.qv-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.qv-label {
		font-family: var(--node-font, system-ui, sans-serif);
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-primary, #1e293b);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global(.dark) .qv-label {
		color: #e2e8f0;
	}

	.qv-sub {
		font-family: var(--font-mono, monospace);
		font-size: 9px;
		color: var(--color-text-tertiary, #94a3b8);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
