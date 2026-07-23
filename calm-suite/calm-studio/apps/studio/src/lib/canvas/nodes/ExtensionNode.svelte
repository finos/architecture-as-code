<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->
<script lang="ts">
	import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/svelte';
	import ValidationBadge from './ValidationBadge.svelte';
	import ReferenceGlassesSlot from './ReferenceGlassesSlot.svelte';
	import { getNodeInterfaces } from './nodeData';
	import { resolvePackNode } from '@calmstudio/extensions';
	import { estimateRectangleNodeSize, ARCHIMATE_ICON_WIDTH } from '$lib/canvas/rectangleNodeSize';

	let { id, data, selected }: NodeProps = $props();
	const interfaces = $derived(getNodeInterfaces(data as Record<string, unknown>));

	const errorCount = $derived((data as Record<string, unknown>).validationErrors as number ?? 0);
	const warnCount = $derived((data as Record<string, unknown>).validationWarnings as number ?? 0);
	const calmType = $derived((data as Record<string, unknown>).calmType as string ?? '');
	const meta = $derived(resolvePackNode(calmType));

	const rectangleLayout = $derived(meta?.rectangleLayout === true);
	const strokeColor = $derived(meta?.color.stroke ?? 'currentColor');
	const bgColor = $derived(meta?.color.bg ?? 'var(--node-generic-bg, #f8f9fa)');
	const borderColor = $derived(meta?.color.border ?? 'var(--node-generic-border, #94a3b8)');
	const label = $derived((data as Record<string, unknown>).label as string ?? (data as Record<string, unknown>).calmId as string ?? calmType);
	const dataClassification = $derived((data as Record<string, unknown>)['data-classification'] as string | undefined);
	const details = $derived((data as Record<string, unknown>).calmDetails as Record<string, unknown> | undefined);
	const hasReference = $derived(
		Boolean((data as Record<string, unknown>).isReference) ||
			(typeof details?.['detailed-architecture'] === 'string' && details['detailed-architecture'].length > 0),
	);
	const isArchimate = $derived(calmType.startsWith('archimate:'));
	const minSize = $derived(
		estimateRectangleNodeSize(label, {
			hasReference,
			hasClassification: !!dataClassification,
			iconWidth: isArchimate ? ARCHIMATE_ICON_WIDTH : undefined,
		}),
	);

	/** 14x14 icon for rectangle (core-style) layout; ArchiMate uses 2em via CSS (20px). */
	const inlineIcon = $derived(
		meta?.icon
			? isArchimate
				? meta.icon
				: meta.icon.replace(/width="16" height="16"/, 'width="14" height="14"')
			: '',
	);

	/** 40x40 icon for stacked icon-above-label layout */
	const stackedIcon = $derived(meta?.icon ? meta.icon.replace(/width="16" height="16"/, 'width="40" height="40"') : '');

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

{#if rectangleLayout}
	<NodeResizer minWidth={minSize.width} minHeight={minSize.height} isVisible={selected} />
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

<div
	class="node"
	class:selected
	class:rectangle-layout={rectangleLayout}
	style:--node-bg={rectangleLayout ? bgColor : undefined}
	style:--node-border={rectangleLayout ? borderColor : undefined}
>
	<ValidationBadge {errorCount} {warnCount} nodeId={(data as Record<string, unknown>).calmId as string ?? id} />
	{#if rectangleLayout}
		{#if inlineIcon}
			<span class="icon icon-inline" class:archimate={isArchimate} style="color: {strokeColor};">
				{@html inlineIcon}
			</span>
		{:else}
			<svg class="icon-fallback icon-inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" aria-hidden="true">
				<rect x="3" y="3" width="18" height="18" rx="3"/>
			</svg>
		{/if}
		<span class="label label-inline">{label}</span>
		<ReferenceGlassesSlot data={data as Record<string, unknown>} placement="inline" />
	{:else}
		<ReferenceGlassesSlot data={data as Record<string, unknown>} />
		{#if stackedIcon}
			<span class="icon icon-stacked" style="color: {strokeColor};">
				{@html stackedIcon}
			</span>
		{:else}
			<svg class="icon-fallback icon-stacked" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2" aria-hidden="true">
				<rect x="3" y="3" width="18" height="18" rx="3"/>
			</svg>
		{/if}
		<span class="label label-stacked">{label}</span>
	{/if}
	{#if dataClassification}
		<span
			class="data-classification-badge"
			class:rectangle-badge={rectangleLayout}
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

	.node.rectangle-layout {
		flex-direction: row;
		align-items: center;
		gap: 7px;
		width: 100%;
		height: 100%;
		padding: 8px 10px;
		background: var(--node-bg);
		border: 1.5px solid var(--node-border);
		border-radius: 3px;
	}

	.node.rectangle-layout.selected {
		border-color: var(--node-selected-ring);
		box-shadow: 0 0 0 1.5px var(--node-selected-ring);
	}

	.node.selected:not(.rectangle-layout) :global(svg) {
		filter: drop-shadow(0 0 2px var(--node-selected-ring));
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-inline :global(svg) {
		width: 14px;
		height: 14px;
	}

	.icon-inline.archimate {
		font-size: 10px;
	}

	.icon-inline.archimate :global(svg) {
		width: 2em;
		height: 2em;
	}

	.icon-fallback {
		color: var(--node-generic-stroke, currentColor);
	}

	.label {
		font-size: 10px;
		font-weight: 600;
		color: var(--node-label-color);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.label-stacked {
		text-align: center;
		max-width: 80px;
	}

	.label-inline {
		min-width: 0;
		flex: 1;
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

	.data-classification-badge.rectangle-badge {
		margin-left: auto;
	}
</style>