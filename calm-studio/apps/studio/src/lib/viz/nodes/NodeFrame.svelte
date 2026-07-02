<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Badge, Severity } from '@calmstudio/calm-core';
	import BadgeCluster from '$lib/viz/badges/BadgeCluster.svelte';

	let {
		badges = [],
		severity = 'unknown',
		children
	}: { badges?: Badge[]; severity?: Severity; children: Snippet } = $props();

	const borderColor = $derived(
		(
			{
				low: 'rgba(6, 182, 212, 0.55)',
				medium: 'rgba(245, 158, 11, 0.6)',
				high: 'rgba(249, 115, 22, 0.65)',
				critical: 'rgba(244, 63, 94, 0.75)',
				unknown: 'transparent'
			} as const
		)[severity]
	);
</script>

<div class="node-frame" style:--sev-border={borderColor} data-severity={severity}>
	{@render children()}
	{#if badges.length > 0}
		<div class="badges-slot"><BadgeCluster {badges} /></div>
	{/if}
</div>

<style>
	.node-frame {
		position: relative;
		border-radius: inherit;
	}
	.node-frame::after {
		content: '';
		position: absolute;
		inset: -1px;
		border-radius: inherit;
		padding: 1px;
		background: linear-gradient(135deg, var(--sev-border) 0%, transparent 65%);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		pointer-events: none;
	}
	.badges-slot {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 2;
	}
</style>
