<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { CalmNode, CalmArchitecture } from '@calmstudio/calm-core';
	let { node, arch }: { node: CalmNode; arch: CalmArchitecture } = $props();

	const children = $derived.by(() => {
		const ids: string[] = [];
		for (const rel of arch.relationships ?? []) {
			const co = (rel['relationship-type'] as { 'composed-of'?: { container?: string; nodes?: string[] } } | undefined)?.[
				'composed-of'
			];
			if (co?.container === node['unique-id'] && Array.isArray(co.nodes)) ids.push(...co.nodes);
		}
		return ids;
	});
</script>

{#if children.length > 0}
	<section class="dr-sec">
		<h3 class="dr-sec-h">Composed-of <span class="count">{children.length}</span></h3>
		{#each children as childId (childId)}
			<div class="dr-item">
				<span class="k">›</span>
				<span class="v">{childId}</span>
			</div>
		{/each}
	</section>
{/if}

<style>
	.dr-sec { margin-bottom: 12px; }
	.dr-sec-h {
		font: 600 9px/1 'Geist Mono', ui-monospace, monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgb(107 114 128 / 1);
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 0 6px;
	}
	.count {
		background: rgb(28 34 48 / 1);
		color: rgb(209 213 219 / 1);
		padding: 2px 5px;
		border-radius: 3px;
	}
	.dr-item {
		font: 500 10px/1.3 'Inter', sans-serif;
		color: rgb(209 213 219 / 1);
		padding: 3px 0;
		display: flex;
		gap: 6px;
		align-items: baseline;
	}
	.dr-item .k {
		font: 600 11px/1 'Geist Mono', monospace;
		color: rgb(107 114 128 / 1);
		flex-shrink: 0;
		min-width: 14px;
	}
</style>
