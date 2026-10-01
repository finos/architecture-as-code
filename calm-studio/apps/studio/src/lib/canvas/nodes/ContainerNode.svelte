<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/svelte';
	import ValidationBadge from './ValidationBadge.svelte';
	import ReferenceGlassesSlot from './ReferenceGlassesSlot.svelte';
	import ContainerRelIcon from './ContainerRelIcon.svelte';
	import { getNodeInterfaces } from './nodeData';
	import { nodeStyleOverrideCss } from '$lib/canvas/buildingBlockStyle';
	let { id, data, selected }: NodeProps = $props();
	const interfaces = $derived(getNodeInterfaces(data as Record<string, unknown>));
	const containmentRels = $derived(
		((data as Record<string, unknown>).containmentRels as
			| Array<{ uniqueId: string; name: string; variant: 'composed-of' | 'deployed-in' }>
			| undefined) ?? []
	);

	let collapsed = $state((data as Record<string, unknown>).collapsed === true);
	const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
	const warnCount = $derived((data as Record<string, unknown>).validationWarnings as number ?? 0);
	const chromeStyle = $derived(nodeStyleOverrideCss((data as Record<string, unknown>).metadata));

	function toggleCollapse() {
		collapsed = !collapsed;
		const event = new CustomEvent('node:toggle-collapse', {
			detail: { nodeId: id, collapsed },
			bubbles: true,
			composed: true,
		});
		document.dispatchEvent(event);
	}
</script>

{#if !collapsed}
	<NodeResizer minWidth={180} minHeight={120} isVisible={selected} />
{/if}

<Handle type="target" position={Position.Top} />
<Handle type="source" position={Position.Bottom} />
<Handle type="target" position={Position.Left} />
<Handle type="source" position={Position.Right} />

{#if interfaces}
	{#each interfaces as iface, i}
		<Handle type="source" position={Position.Right} id={iface['unique-id']} style="top: {20 + i * 20}%" />
	{/each}
{/if}

{#if collapsed}
	<div class="node-shell collapsed" class:selected style={chromeStyle}>
		<ReferenceGlassesSlot data={data as Record<string, unknown>} />
		<ValidationBadge {errorCount} {warnCount} nodeId={(data as Record<string, unknown>).calmId as string ?? id} />
		<div class="collapsed-row">
			<div class="dot"></div>
			<span class="label">{data.label ?? data.calmId}</span>
			<span class="header-right">
				<ContainerRelIcon rels={containmentRels} />
				<button class="toggle" onclick={toggleCollapse} title="Expand" aria-label="Expand container">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
				</button>
			</span>
		</div>
	</div>
{:else}
	<div class="node-shell expanded" class:selected style={chromeStyle}>
		<ReferenceGlassesSlot data={data as Record<string, unknown>} />
		<ValidationBadge {errorCount} {warnCount} nodeId={(data as Record<string, unknown>).calmId as string ?? id} />
		<div class="header">
			<div class="header-left">
				<div class="dot"></div>
				<span class="label">{data.label ?? data.calmId}</span>
			</div>
			<div class="header-right">
				<ContainerRelIcon rels={containmentRels} />
				<button class="toggle" onclick={toggleCollapse} title="Collapse" aria-label="Collapse container">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>
				</button>
			</div>
		</div>
		<div class="body"></div>
	</div>
{/if}

<style>
	/* Do not name this `container` — Tailwind's .container sets max-width at breakpoints
	   and clips the painted box while NodeResizer still grows (R47). */
	.node-shell {
		position: relative;
		font-family: var(--node-font);
		cursor: default;
		user-select: none;
		box-sizing: border-box;
		max-width: none;
		max-height: none;
	}
	.node-shell.collapsed {
		padding: 6px 12px;
		background: var(--node-container-header-bg);
		border: 1.5px solid var(--node-container-border);
		border-radius: 6px;
		min-width: 100px;
	}
	.node-shell.collapsed.selected {
		border-color: var(--node-selected-ring);
	}
	.collapsed-row {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
	}
	.node-shell.expanded {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		border: 1.5px dashed var(--node-container-border);
		border-radius: 8px;
		min-width: 180px;
		min-height: 120px;
		overflow: hidden;
	}
	.node-shell.expanded.selected {
		border-color: var(--node-selected-ring);
		border-style: solid;
	}
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 5px 10px;
		background: var(--node-container-header-bg);
		border-bottom: 1px solid var(--node-container-header-border);
	}
	.header-left {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.header-right {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		flex-shrink: 0;
	}
	.body { flex: 1; }
	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--node-container-stroke);
		opacity: 0.5;
		flex-shrink: 0;
	}
	.label {
		font-size: 10px;
		font-weight: 600;
		color: var(--node-label-color);
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.toggle {
		background: none;
		border: none;
		padding: 2px;
		cursor: pointer;
		color: var(--node-container-badge);
		display: flex;
		border-radius: 3px;
		transition: all 0.15s;
	}
	.toggle:hover {
		background: var(--node-container-header-bg);
		color: var(--node-container-stroke);
	}
</style>