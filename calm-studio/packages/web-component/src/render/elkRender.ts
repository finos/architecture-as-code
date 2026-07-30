// SPDX-FileCopyrightText: 2024 CalmStudio contributors - see NOTICE file
//
// SPDX-License-Identifier: Apache-2.0

// elkjs/lib/elk.bundled.js is CJS — use same compat pattern as mcp-server render.ts
import ELKImport from 'elkjs/lib/elk.bundled.js';
const ELK = (ELKImport as unknown as { default?: new () => { layout: (graph: unknown) => Promise<unknown> } }).default ?? ELKImport as unknown as new () => { layout: (graph: unknown) => Promise<unknown> };

import type { CalmArchitecture } from '@calmstudio/calm-core';
import { renderNodeSvg, renderContainerSvg } from './nodeRenderer.js';
import { renderEdgeSvg, renderEdgeMarkers } from './edgeRenderer.js';
import { renderFlowOverlay, applyFlowDimming, getFlowNodeIds, type EdgeLayout } from './flowOverlay.js';
import { relationshipToEdges, type DiagramEdge } from './relationshipEdges.js';
import { planContainment, emptyContainmentPlan, isNestedContainment } from './containment.js';

// ---------------------------------------------------------------------------
// ELK type helpers
// ---------------------------------------------------------------------------

type ElkChild = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  labels?: Array<{ text: string }>;
  children?: ElkChild[];
};

type ElkEdgeSection = {
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  bendPoints?: Array<{ x: number; y: number }>;
};

type ElkLayouted = {
  children?: ElkChild[];
  edges?: Array<{ id: string; sections?: ElkEdgeSection[] }>;
};

// ---------------------------------------------------------------------------
// Render options
// ---------------------------------------------------------------------------

export interface RenderOptions {
  theme?: 'light' | 'dark';
  direction?: 'DOWN' | 'RIGHT';
  flow?: string;
  containers?: 'nested' | 'edges';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a CalmArchitecture to an interactive SVG string using ELK layout.
 * Supports pack-aware node coloring and icons for all registered packs.
 *
 * @param arch - The CALM architecture to render
 * @param options - Optional render options (theme, direction)
 * @returns Promise resolving to an SVG string
 */
export async function renderELKDiagram(
  arch: CalmArchitecture,
  options: RenderOptions = {}
): Promise<string> {
  const { theme = 'light', direction = 'DOWN', flow: flowId, containers = 'nested' } = options;

  // CALM's meta-schema requires no top-level properties, so `nodes` and
  // `relationships` may both be absent on a valid architecture document.
  // Normalize once and use these locals throughout.
  const nodes = arch.nodes ?? [];
  const relationships = arch.relationships ?? [];

  // Handle empty architecture
  if (nodes.length === 0) {
    const bgColor = theme === 'dark' ? '#1e1e1e' : '#f5f5f5';
    const textColor = theme === 'dark' ? '#ccc' : '#999';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" style="background:${bgColor}">` +
      `<text x="150" y="75" text-anchor="middle" font-family="sans-serif" font-size="14" fill="${textColor}">No nodes</text>` +
      `</svg>`
    );
  }

  const knownNodeIds = new Set(nodes.map((n) => n['unique-id']));
  // The 'nested' | 'edges' union is not enforced at the DOM-attribute boundary
  // (the custom element passes attributes through as strings), so normalize
  // once: anything that is not exactly 'edges' renders nested. Both the plan
  // and the edge filter below must agree, or containment silently vanishes.
  const containersMode: 'nested' | 'edges' = containers === 'edges' ? 'edges' : 'nested';
  const plan = containersMode === 'nested'
    ? planContainment(relationships, knownNodeIds)
    : emptyContainmentPlan();

  // Expand relationships into renderable edges. In nested mode, containment
  // relationships are represented by the plan (nesting + fallback edges) and
  // must not also expand into fan-out edges.
  const diagramEdges: DiagramEdge[] = [
    ...relationships
      .filter((r) => containersMode === 'edges' || !isNestedContainment(r))
      .flatMap((r) => relationshipToEdges(r)),
    ...plan.fallbackEdges,
  ];

  // Build ELK graph
  const NODE_WIDTH = 180;
  const NODE_HEIGHT = 70;

  interface ElkNodeInput {
    id: string;
    width?: number;
    height?: number;
    labels: Array<{ text: string }>;
    layoutOptions?: Record<string, string>;
    children?: ElkNodeInput[];
  }

  const nodeNameMap = new Map(nodes.map((n) => [n['unique-id'], n.name] as const));

  function buildElkNode(id: string): ElkNodeInput {
    const members = plan.childrenOf.get(id);
    const label = { text: nodeNameMap.get(id) ?? id };
    if (members && members.length > 0) {
      return {
        id,
        labels: [label],
        layoutOptions: { 'elk.padding': '[top=44.0,left=16.0,bottom=16.0,right=16.0]' },
        children: members.map(buildElkNode),
      };
    }
    return { id, width: NODE_WIDTH, height: NODE_HEIGHT, labels: [label] };
  }

  const topLevelIds = nodes
    .map((n) => n['unique-id'])
    .filter((id) => !plan.parentOf.has(id));

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '60',
      // edgeCoords ROOT: edge sections arrive root-relative, so the edge-drawing
      // loop needs no offset math (node coords stay parent-relative — see placeNodes).
      'org.eclipse.elk.json.edgeCoords': 'ROOT',
      // INCLUDE_CHILDREN: lets the layered algorithm route edges across hierarchy levels.
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: topLevelIds.map(buildElkNode),
    edges: diagramEdges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const elk = new ELK();
  const layouted = await elk.layout(graph) as ElkLayouted;

  // Build lookup maps
  const nodeTypeMap = new Map<string, string>();
  const nodeDescMap = new Map<string, string>();
  for (const n of nodes) {
    nodeTypeMap.set(n['unique-id'], n['node-type']);
    nodeDescMap.set(n['unique-id'], n.description ?? '');
  }

  const relTypeMap = new Map<string, string>();
  const relIdByRenderId = new Map<string, string>();
  for (const e of diagramEdges) {
    relTypeMap.set(e.id, e.variant);
    relIdByRenderId.set(e.id, e.relationshipId);
  }

  // Flatten the (possibly hierarchical) ELK layout into absolute-position
  // placed nodes, recursively accumulating parent offsets.
  interface PlacedNode {
    id: string;
    x: number; // absolute
    y: number; // absolute
    width: number;
    height: number;
    label: string;
    depth: number;
    isContainer: boolean;
  }

  const placed: PlacedNode[] = [];
  function placeNodes(children: ElkChild[] | undefined, offsetX: number, offsetY: number, depth: number): void {
    for (const child of children ?? []) {
      const x = (child.x ?? 0) + offsetX;
      const y = (child.y ?? 0) + offsetY;
      placed.push({
        id: child.id,
        x,
        y,
        width: child.width ?? NODE_WIDTH,
        height: child.height ?? NODE_HEIGHT,
        label: child.labels?.[0]?.text ?? child.id,
        depth,
        isContainer: (plan.childrenOf.get(child.id)?.length ?? 0) > 0,
      });
      placeNodes(child.children, x, y, depth + 1);
    }
  }
  placeNodes(layouted.children, 0, 0, 0);

  // Compute canvas dimensions from top-level placed nodes
  const PADDING = 40;
  const topLevelPlaced = placed.filter((p) => p.depth === 0);
  const svgWidth = Math.max(400, ...topLevelPlaced.map((p) => p.x + p.width + PADDING));
  const svgHeight = Math.max(200, ...topLevelPlaced.map((p) => p.y + p.height + PADDING));

  const bgColor = theme === 'dark' ? '#1e1e1e' : 'transparent';

  // Build SVG
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="background:${bgColor}">`,
  ];

  // CSS custom properties for theming
  const edgeColor = theme === 'dark' ? '#aaa' : '#555';
  parts.push(
    `<style>`,
    `.calm-node { transition: opacity 0.15s; }`,
    `.calm-node:hover { opacity: 0.85; }`,
    `</style>`,
  );

  // Arrow markers
  parts.push(renderEdgeMarkers());

  // Resolve active flow (if any) and build edge layout map for overlay
  const activeFlow = flowId
    ? (arch.flows ?? []).find((f) => f['unique-id'] === flowId) ?? null
    : null;

  const activeFlowEdgeIds = new Set<string>(
    activeFlow ? activeFlow.transitions.map((t) => t['relationship-unique-id']) : []
  );

  const activeFlowNodeIds = activeFlow
    ? getFlowNodeIds(arch, activeFlow)
    : new Set<string>();

  // Edge layouts grouped by source relationship id, so the flow overlay can
  // animate every render edge a fanned-out relationship expands into.
  const edgeLayoutsByRelationship = new Map<string, EdgeLayout[]>();

  // Draw container boxes first, outermost (lowest depth) first, so children paint on top
  for (const p of placed.filter((n) => n.isContainer).sort((a, b) => a.depth - b.depth)) {
    const nodeType = nodeTypeMap.get(p.id) ?? 'system';
    const description = nodeDescMap.get(p.id) ?? '';
    const nodeOpacity =
      activeFlow && activeFlowNodeIds.size > 0 && !activeFlowNodeIds.has(p.id) ? '0.3' : '1';
    const containerSvg = renderContainerSvg({
      id: p.id,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      name: p.label,
      nodeType,
      description,
      theme,
    });
    parts.push(nodeOpacity !== '1' ? `<g opacity="${nodeOpacity}">${containerSvg}</g>` : containerSvg);
  }

  // Draw edges above container boxes, below leaf nodes
  for (const edge of layouted.edges ?? []) {
    for (const section of edge.sections ?? []) {
      const points: Array<{ x: number; y: number }> = [];
      if (section.startPoint) {
        points.push({ x: section.startPoint.x, y: section.startPoint.y });
      }
      for (const bp of section.bendPoints ?? []) {
        points.push({ x: bp.x, y: bp.y });
      }
      if (section.endPoint) {
        points.push({ x: section.endPoint.x, y: section.endPoint.y });
      }
      if (points.length >= 2) {
        // Store layout for flow overlay before rendering edge
        const relationshipId = relIdByRenderId.get(edge.id) ?? edge.id;
        const layouts = edgeLayoutsByRelationship.get(relationshipId) ?? [];
        layouts.push({ id: edge.id, points });
        edgeLayoutsByRelationship.set(relationshipId, layouts);

        const relType = relTypeMap.get(edge.id);
        // Flows reference the relationship's unique-id — match on that, not the
        // render id, so fan-out edges (`uid__N`) dim and animate correctly.
        const edgeOpacity = applyFlowDimming(relationshipId, activeFlowEdgeIds, true);
        const edgeSvg = renderEdgeSvg({
          id: edge.id,
          points,
          relationshipType: relType,
        })
          .replace('stroke="#555"', `stroke="${edgeColor}"`)
          .replace('stroke="#888"', `stroke="${edgeColor}"`);

        // Wrap in opacity group when flow is active
        if (activeFlow) {
          parts.push(`<g opacity="${edgeOpacity}">${edgeSvg}</g>`);
        } else {
          parts.push(edgeSvg);
        }
      }
    }
  }

  // Draw leaf nodes on top of containers and edges
  for (const p of placed.filter((n) => !n.isContainer)) {
    const nodeType = nodeTypeMap.get(p.id) ?? 'system';
    const description = nodeDescMap.get(p.id) ?? '';

    // Dim nodes not connected to the active flow
    const nodeOpacity =
      activeFlow && activeFlowNodeIds.size > 0 && !activeFlowNodeIds.has(p.id)
        ? '0.3'
        : '1';

    const nodeSvg = renderNodeSvg({
      id: p.id,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
      name: p.label,
      nodeType,
      description,
    });

    if (activeFlow && nodeOpacity !== '1') {
      parts.push(`<g opacity="${nodeOpacity}">${nodeSvg}</g>`);
    } else {
      parts.push(nodeSvg);
    }
  }

  // Append flow overlay ABOVE edges and nodes so animated dots are not dimmed
  if (activeFlow) {
    parts.push(renderFlowOverlay(activeFlow, edgeLayoutsByRelationship));
  }

  parts.push('</svg>');
  return parts.join('\n');
}
