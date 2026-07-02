<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { CalmNode } from '@calmstudio/calm-core';
	let { node }: { node: CalmNode } = $props();

	const controls = $derived(
		Object.entries(((node as unknown as { controls?: Record<string, unknown> }).controls ?? {}) as Record<string, unknown>) as Array<[string, unknown]>
	);
	const totalMitigations = $derived(
		controls.reduce((sum, [, c]) => {
			const reqs = ((c as { requirements?: Array<{ config?: { mitigates?: unknown } }> } | undefined)?.requirements ?? []);
			return (
				sum +
				reqs.reduce((s: number, r) => s + (Array.isArray(r?.config?.mitigates) ? r.config.mitigates.length : 0), 0)
			);
		}, 0)
	);
</script>

{#if controls.length > 0}
	<section class="dr-sec">
		<h3 class="dr-sec-h">
			Controls
			<span class="count">{controls.length}</span>
		</h3>
		{#each controls as [id, control] (id)}
			<div class="dr-item">
				<span class="k">{id}</span>
				<span class="v">{((control as { description?: string } | undefined)?.description) ?? ''}</span>
			</div>
		{/each}
		{#if totalMitigations > 0}
			<p class="meta">{totalMitigations} threat{totalMitigations === 1 ? '' : 's'} mitigated</p>
		{/if}
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
		font: 500 9px/1 'Geist Mono', monospace;
		color: rgb(107 114 128 / 1);
		flex-shrink: 0;
		min-width: 30px;
	}
	.meta {
		font: 500 9px/1 'Geist Mono', monospace;
		color: rgb(107 114 128 / 1);
		margin: 6px 0 0;
	}
</style>
