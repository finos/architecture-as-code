<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  ThreatBadge.svelte — Threat-model decorator badge overlay (#2551).

  Renders an absolute-positioned circular badge in the bottom-right of a
  node when at least one threat-model decorator's affected-nodes (or its
  parent applies-to as fallback) references this node. Click opens the
  properties panel Threats tab via scroll-to coordination.

  Parent .node must have position: relative for the badge to anchor.
-->
<script lang="ts">
	import { threatsForNode } from '$lib/stores/decorators.svelte';
	import { setScrollToElementId } from '$lib/stores/validation.svelte';

	interface Props {
		nodeId: string;
	}

	let { nodeId }: Props = $props();

	const count = $derived(threatsForNode(nodeId).length);
	const tooltip = $derived(`${count} threat${count !== 1 ? 's' : ''} reference${count === 1 ? 's' : ''} this node`);

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		setScrollToElementId(nodeId);
	}
</script>

{#if count > 0}
	<button
		class="threat-badge"
		title={tooltip}
		aria-label={tooltip}
		onclick={handleClick}
	>
		<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
			<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		<span class="count">{count > 99 ? '99+' : count}</span>
	</button>
{/if}

<style>
	.threat-badge {
		position: absolute;
		bottom: -8px;
		right: -8px;
		z-index: 10;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		border-radius: 10px;
		border: 1.5px solid #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		background-color: #cf222e;
		color: #fff;
		font-family: var(--node-font, system-ui, sans-serif);
		font-size: 10px;
		font-weight: 700;
		cursor: pointer;
		line-height: 1;
		transition: transform 0.1s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
	}

	.threat-badge:hover {
		transform: scale(1.15);
	}

	:global(.dark) .threat-badge {
		border-color: #0f1320;
		background-color: #ff5d6c;
	}

	.count {
		font-variant-numeric: tabular-nums;
	}
</style>
