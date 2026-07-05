<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/svelte';
	import ValidationBadge from './ValidationBadge.svelte';
	let { id, data, selected }: NodeProps = $props();
	const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
	const warnCount = $derived((data as Record<string, unknown>).validationWarnings as number ?? 0);
	const dataClassification = $derived((data as Record<string, unknown>)['data-classification'] as string | undefined);

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

<NodeResizer minWidth={80} minHeight={40} isVisible={selected} />
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
	<span class="label">{data.label ?? data.calmId}</span>
	{#if data.calmType}
		<span class="badge">{data.calmType}</span>
	{/if}
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
		justify-content: center;
		width: 100%;
		height: 100%;
		padding: 8px 10px;
		background: var(--node-generic-bg);
		border: 1.5px dashed var(--node-generic-border);
		border-radius: 4px;
		font-family: var(--node-font);
		cursor: default;
		user-select: none;
	}
	.node.selected {
		border-color: var(--node-selected-ring);
		border-style: solid;
		box-shadow: 0 0 0 1.5px var(--node-selected-ring);
	}
	.label {
		font-size: 10px;
		font-weight: 600;
		color: var(--node-label-color);
		text-align: center;
		max-width: 100px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.badge {
		font-size: 9px;
		font-weight: 500;
		color: var(--node-generic-badge);
		font-style: italic;
		margin-top: 2px;
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
		margin-top: 2px;
	}
</style>
