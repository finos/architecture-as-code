<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  ConnectsEdge.svelte — CALM "connects" relationship edge.
  Visual style: solid line + filled arrowhead.
  Protocol labels render as inline pill on the path.
  Flow overlays render as sibling group (outside the dimmed wrapper).
-->
<script lang="ts">
	import { getContext } from 'svelte';
	import { BaseEdge, EdgeLabel, type EdgeProps, type Node } from '@xyflow/svelte';
	import FlowOverlay from './FlowOverlay.svelte';
	import type { CalmTransition } from '@calmstudio/calm-core';
	import {
		CANVAS_NODES_CONTEXT,
		getRoutedEdgePath,
		type CanvasNodesGetter,
	} from '../edgeRouting/routedEdgePath';
	import { appearanceForEdgeData, markerId, paintStyle } from './edgeVisual';
	import EdgeDecoration from './EdgeDecoration.svelte';
	import RelationshipHoverGlow from './RelationshipHoverGlow.svelte';

	let {
		id,
		source,
		target,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		label,
		data,
		markerEnd,
		style
	}: EdgeProps = $props();

	const getCanvasNodes = getContext<CanvasNodesGetter>(CANVAS_NODES_CONTEXT) ?? (() => [] as Node[]);
	const edgeData = $derived((data ?? {}) as Record<string, unknown>);
	const appearance = $derived(appearanceForEdgeData(edgeData));

	const [edgePath, labelX, labelY] = $derived(
		getRoutedEdgePath(getCanvasNodes(), {
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition,
			sourceId: source,
			targetId: target,
			routing: appearance.routing,
		})
	);

	const protocolLabel = $derived(edgeData.protocol ?? label);
	const description = $derived(typeof edgeData.description === 'string' ? edgeData.description : '');
	const markerEndUrl = $derived(
		appearance.lineColor ? `url(#${markerId('filled', id)})` : 'url(#marker-arrow-filled)',
	);

	const validationStyle = $derived(
		edgeData.validationSeverity === 'error'
			? 'stroke: #dc2626; stroke-width: 2.5;'
			: edgeData.validationSeverity === 'warning'
				? 'stroke: #d97706; stroke-width: 2;'
				: undefined
	);
	const finalStyle = $derived(paintStyle(appearance, style, validationStyle));

	const flowTransition = $derived(edgeData.flowTransition as CalmTransition | null | undefined);
	const dimmed = $derived(edgeData.dimmed === true);
	let hovered = $state(false);
</script>

<g
	role="presentation"
	style={dimmed ? 'opacity: 0.3' : ''}
	onmouseenter={() => (hovered = true)}
	onmouseleave={() => (hovered = false)}
	>
	<RelationshipHoverGlow {source} {target} path={edgePath} {hovered} />
	<BaseEdge
		{id}
		path={edgePath}
		markerEnd={markerEndUrl}
		style={finalStyle}
	/>
	<EdgeDecoration
		edgeId={id}
		kind="filled"
		lineColor={appearance.lineColor}
		{description}
		descriptionDisplay={appearance.descriptionDisplay}
		textColor={appearance.textColor}
		{labelX}
		{labelY}
		{hovered}
	/>

	{#if protocolLabel}
		<EdgeLabel x={labelX} y={labelY} class="nodrag nopan">
			<span class="edge-label">
				{protocolLabel}
			</span>
		</EdgeLabel>
	{/if}
</g>

{#if flowTransition}
	<FlowOverlay
		edgePath={edgePath}
		edgeId={id}
		sequenceNumber={flowTransition['sequence-number']}
		description={flowTransition.description}
		direction={flowTransition.direction ?? 'source-to-destination'}
		labelX={labelX}
		labelY={labelY}
	/>
{/if}

<style>
	.edge-label {
		display: inline-block;
		padding: 2px 8px;
		font-family: var(--node-font);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--color-text-secondary);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	:global(.dark) .edge-label {
		background: #111827;
		border-color: #334155;
		color: #94a3b8;
	}
</style>
