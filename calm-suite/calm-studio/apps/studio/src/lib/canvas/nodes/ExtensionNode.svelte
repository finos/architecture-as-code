<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import ValidationBadge from './ValidationBadge.svelte';
	import { resolvePackNode } from '@calmstudio/extensions';

	let { id, data, selected }: NodeProps = $props();

	const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
	const warnCount = $derived((data as Record<string, unknown>).validationWarnings as number ?? 0);
	const calmType = $derived((data as Record<string, unknown>).calmType as string ?? '');
	const meta = $derived(resolvePackNode(calmType));

	const strokeColor = $derived(meta?.color.stroke ?? 'currentColor');
	const label = $derived((data as Record<string, unknown>).label as string ?? (data as Record<string, unknown>).calmId as string ?? calmType);
	const dataClassification = $derived((data as Record<string, unknown>)['data-classification'] as string | undefined);

	/** Scale 16x16 SVG icons up to 40x40 for canvas rendering */
	const scaledIcon = $derived(meta?.icon ? meta.icon.replace(/width="16" height="16"/, 'width="40" height="40"') : '');

	/** Returns badge style for a data-classification value */
	function getClassificationStyle(dc: string): string {
		switch (dc.toLowerCase()) {
			case 'pii': return 'background:#fef2f2;color:#dc2626;border-color:#fca5a5;';
			case 'confidential': return 'background:#fffbeb;color:#d97706;border-color:#fcd34d;';
			case 'public': return 'background:#f0fdf4;color:#16a34a;border-color:#86efac;';
			default: return 'background:#f1f5f9;color:#64748b;border-color:#cbd5e1;';
		}
	}
</script>

<Handle type="target" position={Position.Top} />
<Handle type="source" position={Position.Bottom} />
<Handle type="target" position={Position.Left} />
<Handle type="source" position={Position.Right} />

{#if data.interfaces}
	{#each data.interfaces as iface, i}
		<Handle type="source" position={Position.Right} id={iface['unique-id']} style="top: {20 + i * 20}%" />
	{/each}
{/if}

<div class="node" class:selected>
	<ValidationBadge {errorCount} {warnCount} nodeId={(data as Record<string, unknown>).calmId as string ?? id} />
	{#if scaledIcon}
		<span class="icon" style="color: {strokeColor};">
			{@html scaledIcon}
		</span>
	{:else}
		<svg class="icon-fallback" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" aria-hidden="true">
			<rect x="3" y="3" width="18" height="18" rx="3"/>
		</svg>
	{/if}
	<span class="label">{label}</span>
	{#if dataClassification}
		<span
			class="data-classification-badge"
			style={getClassificationStyle(dataClassification)}
			title="Data classification: {dataClassification}"
		>{dataClassification}</span>
	{/if}
</div>

<style>
	.node {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 4px 6px;
		cursor: default;
		user-select: none;
		font-family: var(--node-font);
	}

	.node.selected :global(svg) {
		filter: drop-shadow(0 0 2px var(--node-selected-ring));
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-fallback {
		color: var(--node-generic-stroke, currentColor);
	}

	.label {
		font-size: 10px;
		font-weight: 600;
		color: var(--node-label-color);
		text-align: center;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.data-classification-badge {
		font-size: 8px;
		font-weight: 700;
		padding: 1px 5px;
		border-radius: 6px;
		border: 1px solid;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1.4;
	}
</style>
