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
	<svg width="56" height="40" viewBox="0 0 56 40" fill="none" aria-hidden="true">
		<rect x="2" y="2" width="52" height="36" rx="3" fill="var(--node-webclient-bg)" stroke="var(--node-webclient-stroke)" stroke-width="1.5" />
		<line x1="2" y1="12" x2="54" y2="12" stroke="var(--node-webclient-stroke)" stroke-width="1.2" />
		<circle cx="9" cy="7" r="1.8" fill="var(--node-webclient-stroke)" opacity="0.5" />
		<circle cx="15" cy="7" r="1.8" fill="var(--node-webclient-stroke)" opacity="0.5" />
		<circle cx="21" cy="7" r="1.8" fill="var(--node-webclient-stroke)" opacity="0.5" />
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
	.node.selected svg rect,
	.node.selected svg line {
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
