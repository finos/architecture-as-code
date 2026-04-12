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
	<svg width="32" height="40" viewBox="0 0 32 40" fill="none" aria-hidden="true">
		<circle cx="16" cy="9" r="7" fill="var(--node-actor-bg)" stroke="var(--node-actor-stroke)" stroke-width="1.5" />
		<path d="M6 36 Q6 22 16 22 Q26 22 26 36" fill="var(--node-actor-bg)" stroke="var(--node-actor-stroke)" stroke-width="1.5" />
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
		padding: 4px 6px;
		cursor: default;
		user-select: none;
		font-family: var(--node-font);
	}
	.node.selected svg circle,
	.node.selected svg path {
		stroke: var(--node-selected-ring);
		stroke-width: 2;
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
