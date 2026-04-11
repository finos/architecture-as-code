<!-- SPDX-FileCopyrightText: 2026 CalmStudio Contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  FlowOverlay.svelte — Animated dot + sequence badge SVG overlay for flow visualization.

  This component is rendered as a SIBLING of the edge element (NOT a child) so that
  it is not affected by the parent edge's opacity dimming. It renders:
    1. A hidden <path> element as the motion path reference for animateMotion.
    2. An animated blue dot that travels along the edge path in the correct direction.
    3. A sequence number badge at the edge midpoint.
    4. A tooltip (foreignObject) showing the transition summary text on badge hover.

  Usage:
    <FlowOverlay
      edgePath={svgPathString}
      edgeId={uniqueEdgeId}
      sequenceNumber={1}
      summary="User sends request"
      direction="source-to-destination"
      labelX={midpointX}
      labelY={midpointY}
    />
-->
<script lang="ts">
	let {
		edgePath,
		edgeId,
		sequenceNumber,
		summary,
		direction = 'source-to-destination',
		labelX,
		labelY,
	}: {
		edgePath: string;
		edgeId: string;
		sequenceNumber: number;
		summary: string;
		direction?: 'source-to-destination' | 'destination-to-source';
		labelX: number;
		labelY: number;
	} = $props();

	let showTooltip = $state(false);

	// keyPoints drives direction: 0→1 = source-to-destination; 1→0 = destination-to-source
	const keyPoints = $derived(direction === 'destination-to-source' ? '1;0' : '0;1');

	const motionPathId = $derived(`${edgeId}-flow-path`);

	// Tooltip positioning — offset 16px upward from badge center
	const tooltipX = $derived(labelX + 16);
	const tooltipY = $derived(labelY - 40);
</script>

<g class="flow-overlay" aria-hidden="true">
	<!-- Hidden path used as animateMotion reference (invisible, only used for mpath href) -->
	<path id={motionPathId} d={edgePath} fill="none" stroke="none" />

	<!-- Animated dot travelling along the edge -->
	<circle r="5" fill="#3b82f6" stroke="white" stroke-width="1.5">
		<animateMotion
			dur="1.8s"
			repeatCount="indefinite"
			keyPoints={keyPoints}
			keyTimes="0;1"
			calcMode="linear"
		>
			<mpath href={`#${motionPathId}`} />
		</animateMotion>
	</circle>

	<!-- Sequence badge group at edge midpoint -->
	<g transform={`translate(${labelX}, ${labelY})`}>
		<!-- Badge background circle -->
		<circle r="10" fill="#3b82f6" />
		<!-- Sequence number text -->
		<text
			x="0"
			y="0"
			text-anchor="middle"
			dominant-baseline="central"
			fill="white"
			font-size="9"
			font-weight="bold"
			font-family="var(--font-sans, sans-serif)"
		>{sequenceNumber}</text>
		<!-- Transparent hit area for hover detection (larger than badge).
		     Parent <g> is aria-hidden="true"; this circle is purely visual. -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<circle
			r="14"
			fill="transparent"
			style="cursor: pointer;"
			onpointerenter={() => (showTooltip = true)}
			onpointerleave={() => (showTooltip = false)}
		/>
	</g>

	<!-- Tooltip: shown on badge hover via foreignObject -->
	{#if showTooltip && summary}
		<foreignObject x={tooltipX} y={tooltipY} width="180" height="60">
			<div class="flow-tooltip">
				{summary}
			</div>
		</foreignObject>
	{/if}
</g>

<style>
	.flow-overlay {
		pointer-events: none;
	}

	/* Re-enable pointer events on the hit area circle only */
	.flow-overlay circle[r="14"] {
		pointer-events: all;
	}

	.flow-tooltip {
		display: inline-block;
		padding: 4px 8px;
		background: #1e293b;
		color: #f8fafc;
		font-size: 11px;
		font-family: var(--font-sans, sans-serif);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
		white-space: normal;
		word-break: break-word;
		max-width: 176px;
		pointer-events: none;
	}
</style>
