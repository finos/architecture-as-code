<!--
  SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
  SPDX-License-Identifier: Apache-2.0
-->
<script lang="ts">
	import type { Badge, Severity } from '@calmstudio/calm-core';

	let {
		threats = [],
		onselectthreat
	}: { threats?: Badge[]; onselectthreat?: (badge: Badge) => void } = $props();

	const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

	const buckets = $derived.by(() => {
		const out = new Map<Severity, Badge[]>();
		for (const s of SEVERITY_ORDER) out.set(s, []);
		for (const b of threats) {
			const s = (b.severity ?? 'unknown') as Severity;
			if (out.has(s)) out.get(s)!.push(b);
		}
		return out;
	});

	const sevLabel: Record<Severity, string> = {
		critical: 'Critical',
		high: 'High',
		medium: 'Medium',
		low: 'Low',
		unknown: 'Unknown'
	};
	const sevColor: Record<Severity, string> = {
		critical: '#f43f5e',
		high: '#f97316',
		medium: '#f59e0b',
		low: '#06b6d4',
		unknown: '#6b7280'
	};
</script>

<aside class="threat-panel" aria-label="Threats">
	<header class="tp-head">Threats</header>
	<p class="tp-sub">{threats.length} total</p>
	{#each SEVERITY_ORDER as sev (sev)}
		{@const list = buckets.get(sev) ?? []}
		{#if list.length > 0}
			<section class="tp-bucket">
				<h3 class="tp-bucket-h" style:color={sevColor[sev]}>
					<span class="d" style:background-color={sevColor[sev]}></span>
					{sevLabel[sev]} · {list.length}
				</h3>
				{#each list as badge (badge.id)}
					<button class="tp-item" onclick={() => onselectthreat?.(badge)} title={(badge.data?.description as string) ?? ''}>
						<span class="id">{badge.id}</span><span class="lbl">{badge.label ?? badge.id}</span>
					</button>
				{/each}
			</section>
		{/if}
	{/each}
</aside>

<style>
	.threat-panel {
		position: absolute;
		top: 12px;
		right: 12px;
		bottom: 12px;
		width: 240px;
		background: rgba(15, 17, 22, 0.92);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid rgb(31 36 46 / 1);
		border-radius: 10px;
		padding: 12px;
		z-index: 10;
		overflow-y: auto;
		color: rgb(209 213 219 / 1);
	}
	.tp-head {
		font: 600 11px/1 'Inter', sans-serif;
		color: rgb(243 244 246 / 1);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0;
	}
	.tp-sub {
		font: 500 10px/1 'Geist Mono', ui-monospace, monospace;
		color: rgb(107 114 128 / 1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 6px 0 10px;
	}
	.tp-bucket {
		margin-bottom: 12px;
	}
	.tp-bucket-h {
		font: 600 10px/1 'Geist Mono', monospace;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		display: flex;
		align-items: center;
		gap: 5px;
		margin: 0 0 6px;
	}
	.tp-bucket-h .d {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.tp-item {
		display: block;
		width: 100%;
		text-align: left;
		background: transparent;
		border: 0;
		font: 500 10px/1.3 'Inter', sans-serif;
		color: rgb(209 213 219 / 1);
		padding: 4px 6px;
		border-radius: 4px;
		cursor: pointer;
	}
	.tp-item:hover {
		background: rgba(255, 255, 255, 0.04);
	}
	.tp-item .id {
		font: 500 9px/1 'Geist Mono', monospace;
		color: rgb(107 114 128 / 1);
		margin-right: 6px;
	}
	.tp-item .lbl {
		font: 500 10px/1.3 'Inter', sans-serif;
	}
</style>
