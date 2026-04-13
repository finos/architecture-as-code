<!-- SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

<!--
  EdgeMarkers.svelte — Shared SVG marker definitions for CALM edge types.
  Rendered ONCE in the canvas DOM (inside SvelteFlow). All edge components
  reference these markers by ID via markerEnd="url(#marker-*)".

  orient="auto-start-reverse" is required on all markers so they rotate
  correctly with edge direction — without it markers point in wrong direction
  on edges with reversed source/target.
-->
<svg style="position: absolute; width: 0; height: 0; overflow: hidden;" aria-hidden="true">
  <defs>
    <!-- Filled arrowhead — used by ConnectsEdge and InteractsEdge -->
    <marker
      id="marker-arrow-filled"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto-start-reverse"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
    </marker>

    <!-- Open diamond — used by DeployedInEdge -->
    <marker
      id="marker-diamond-open"
      markerWidth="12"
      markerHeight="8"
      refX="11"
      refY="4"
      orient="auto-start-reverse"
    >
      <polygon
        points="0 4, 5.5 0, 11 4, 5.5 8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </marker>

    <!-- Filled diamond — used by ComposedOfEdge -->
    <marker
      id="marker-diamond-filled"
      markerWidth="12"
      markerHeight="8"
      refX="11"
      refY="4"
      orient="auto-start-reverse"
    >
      <polygon points="0 4, 5.5 0, 11 4, 5.5 8" fill="currentColor" />
    </marker>

    <!-- Open arrowhead — used by OptionsEdge -->
    <marker
      id="marker-arrow-open"
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto-start-reverse"
    >
      <polyline
        points="0 0, 9 3.5, 0 7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
    </marker>
  </defs>
</svg>
