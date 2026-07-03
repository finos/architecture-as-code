<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/svelte';
	import ValidationBadge from './ValidationBadge.svelte';
	let { id, data, selected }: NodeProps = $props();
	const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
	const warnCount = $derived((data as Record<string, unknown>).validationWarnings as number ?? 0);
</script>

<NodeResizer minWidth={90} minHeight={50} isVisible={selected} />
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
	<div class="icon">
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--node-service-stroke)" stroke-width="1.5" aria-hidden="true">
			<circle cx="12" cy="12" r="3" />
			<path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke-linecap="round" />
		</svg>
	</div>
	<span class="label">{data.label ?? data.calmId}</span>
</div>

<style>
	.node {
		position: relative;
		display: flex;
		align-items: center;
		gap: 7px;
		width: 100%;
		height: 100%;
		padding: 8px 10px;
		background: var(--node-service-bg);
		border: 1.5px solid var(--node-service-border);
		border-radius: 10px;
		font-family: var(--node-font);
		cursor: default;
		user-select: none;
	}
	.node.selected {
		border-color: var(--node-selected-ring);
		box-shadow: 0 0 0 1.5px var(--node-selected-ring);
	}
	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.label {
		font-size: 10px;
		font-weight: 600;
		color: var(--node-label-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
