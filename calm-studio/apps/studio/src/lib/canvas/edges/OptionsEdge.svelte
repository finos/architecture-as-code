<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  OptionsEdge.svelte — CALM "options" relationship edge.
  Visual style: dotted line (2 4) + open arrowhead marker.
  Represents an optional or alternative relationship between nodes.
  Flow overlays render as sibling group (outside the dimmed wrapper).
-->
<script lang="ts">
	import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';
	import FlowOverlay from './FlowOverlay.svelte';
	import type { CalmTransition } from '@calmstudio/calm-core';

	let {
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		data,
		style
	}: EdgeProps = $props();

	const [edgePath, labelX, labelY] = $derived(
		getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
	);

	const validationStyle = $derived(
		(data as Record<string, unknown>)?.validationSeverity === 'error'
			? 'stroke: #dc2626; stroke-width: 2.5;'
			: (data as Record<string, unknown>)?.validationSeverity === 'warning'
				? 'stroke: #d97706; stroke-width: 2;'
				: undefined
	);
	const finalStyle = $derived(validationStyle
		? `stroke-dasharray: 2 4; ${style ?? ''} ${validationStyle}`
		: `stroke-dasharray: 2 4; ${style ?? ''}`);

	const flowTransition = $derived((data as Record<string, unknown>)?.flowTransition as CalmTransition | null | undefined);
	const dimmed = $derived((data as Record<string, unknown>)?.dimmed === true);
</script>

<g style={dimmed ? 'opacity: 0.3' : ''}>
	<BaseEdge
		{id}
		path={edgePath}
		markerEnd="url(#marker-arrow-open)"
		style={finalStyle}
	/>
</g>

{#if flowTransition}
	<FlowOverlay
		edgePath={edgePath}
		edgeId={id}
		sequenceNumber={flowTransition['sequence-number']}
		summary={flowTransition.summary}
		direction={flowTransition.direction ?? 'source-to-destination'}
		labelX={labelX}
		labelY={labelY}
	/>
{/if}
