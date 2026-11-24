<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  DeployedInEdge.svelte — CALM "deployed-in" relationship edge.
  Visual style: solid line + open diamond marker.
  Represents a deployment relationship (component deployed inside a node).
  Flow overlays render as sibling group (outside the dimmed wrapper).
-->
<script lang="ts">
	import { getContext } from 'svelte';
	import { BaseEdge, type EdgeProps, type Node } from '@xyflow/svelte';
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
		data,
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

	const validationStyle = $derived(
		edgeData.validationSeverity === 'error'
			? 'stroke: #dc2626; stroke-width: 2.5;'
			: edgeData.validationSeverity === 'warning'
				? 'stroke: #d97706; stroke-width: 2;'
				: undefined
	);
	const finalStyle = $derived(paintStyle(appearance, style, validationStyle));
	const description = $derived(typeof edgeData.description === 'string' ? edgeData.description : '');
	const markerEndUrl = $derived(
		appearance.lineColor ? `url(#${markerId('diamond-open', id)})` : 'url(#marker-diamond-open)',
	);

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
		kind="diamond-open"
		lineColor={appearance.lineColor}
		{description}
		descriptionDisplay={appearance.descriptionDisplay}
		textColor={appearance.textColor}
		{labelX}
		{labelY}
		{hovered}
	/>
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
