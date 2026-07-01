<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import ValidationBadge from './ValidationBadge.svelte';
	let { id, data, selected }: NodeProps = $props();
	const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
	const warnCount = $derived((data as Record<string, unknown>).validationWarnings as number ?? 0);
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
	<svg width="48" height="44" viewBox="0 0 48 44" fill="none" aria-hidden="true">
		<ellipse cx="24" cy="8" rx="20" ry="6" fill="var(--node-database-bg)" stroke="var(--node-database-stroke)" stroke-width="1.5" />
		<path d="M4 8v28c0 3.3 9 6 20 6s20-2.7 20-6V8" fill="var(--node-database-bg)" stroke="var(--node-database-stroke)" stroke-width="1.5" />
		<ellipse cx="24" cy="36" rx="20" ry="6" fill="none" stroke="var(--node-database-stroke)" stroke-width="1.5" />
		<path d="M4 20c0 3.3 9 6 20 6s20-2.7 20-6" stroke="var(--node-database-stroke)" stroke-width="1" opacity="0.4" />
	</svg>
	<span class="label">{data.label ?? data.calmId}</span>
</div>

<style>
	.node {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 2px 4px;
		cursor: default;
		user-select: none;
		font-family: var(--node-font);
	}
	.node.selected svg ellipse,
	.node.selected svg path {
		stroke: var(--node-selected-ring);
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
</style>
