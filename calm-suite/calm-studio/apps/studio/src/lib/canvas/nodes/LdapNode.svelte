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
	<svg width="40" height="48" viewBox="0 0 40 48" fill="none" aria-hidden="true">
		<path
			d="M20 2 L36 9 L36 26 Q36 40 20 46 Q4 40 4 26 L4 9 Z"
			fill="var(--node-ldap-bg)"
			stroke="var(--node-ldap-stroke)"
			stroke-width="1.5"
			stroke-linejoin="round"
		/>
		<circle cx="20" cy="20" r="4" stroke="var(--node-ldap-stroke)" stroke-width="1.2" fill="none" />
		<path d="M20 24v6M20 28h3" stroke="var(--node-ldap-stroke)" stroke-width="1.2" stroke-linecap="round" />
	</svg>
	<span class="label">{data.label ?? data.calmId}</span>
</div>

<style>
	.node {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 2px 4px;
		cursor: default;
		user-select: none;
		font-family: var(--node-font);
	}
	.node.selected svg path,
	.node.selected svg circle {
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
