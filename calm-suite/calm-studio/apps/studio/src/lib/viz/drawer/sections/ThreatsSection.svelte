<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { CalmNode, CalmDecorator, Severity } from '@calmstudio/calm-core';
	import { severityFromDecorator } from '@calmstudio/calm-core';
	let { node }: { node: CalmNode } = $props();

	const threats = $derived(
		(((node as unknown as { decorators?: unknown[] }).decorators ?? []) as CalmDecorator[]).filter(
			(d) => d?.type === 'threat'
		)
	);

	const sevColor: Record<Severity, string> = {
		critical: '#f43f5e',
		high: '#f97316',
		medium: '#f59e0b',
		low: '#06b6d4',
		unknown: '#6b7280'
	};
</script>

{#if threats.length > 0}
	<section class="dr-sec">
		<h3 class="dr-sec-h">Threats <span class="count">{threats.length}</span></h3>
		{#each threats as t (t['unique-id'])}
			<div class="dr-item">
				<span class="dot" style:background-color={sevColor[severityFromDecorator(t)]}></span>
				<span class="k">{t['unique-id']}</span>
				<span class="v">{(t.data?.name as string) ?? ''}</span>
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
	.dr-item .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 5px;
	}
	.dr-item .k {
		font: 500 9px/1 'Geist Mono', monospace;
		color: rgb(107 114 128 / 1);
		flex-shrink: 0;
		min-width: 60px;
	}
</style>
