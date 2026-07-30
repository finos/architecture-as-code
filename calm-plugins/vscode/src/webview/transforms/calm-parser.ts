import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import dagre from '@dagrejs/dagre';
import type { CalmArchitecture } from './calm-editor-transformer';

export interface ParsedCALMData {
    nodes: Node[];
    edges: Edge[];
}

const NODE_WIDTH = 250;
const NODE_HEIGHT = 60;
const GROUP_PADDING = 50;
const CONTAINER_BASE_WIDTH = 500;
const CONTAINER_BASE_HEIGHT = 350;
const CONTAINER_CHILD_WIDTH_INCREMENT = 150;
const CONTAINER_CHILD_HEIGHT_INCREMENT = 120;

export function parseCALMData(
    arch: CalmArchitecture,
    direction: 'DOWN' | 'RIGHT' = 'DOWN'
): ParsedCALMData {
    if (!arch || !arch.nodes) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Identify containers from relationships
    const containerIds = new Set<string>();
    const parentMap = new Map<string, string>();
    const containerVariant = new Map<string, string>();

    for (const rel of arch.relationships ?? []) {
        const rt = rel['relationship-type'] as
            | Record<string, unknown>
            | undefined;
        if (!rt) continue;

        const deployedIn = rt['deployed-in'] as
            | { container: string; nodes: string[] }
            | undefined;
        const composedOf = rt['composed-of'] as
            | { container: string; nodes: string[] }
            | undefined;
        const containment = deployedIn ?? composedOf;

        if (containment) {
            containerIds.add(containment.container);
            containerVariant.set(
                containment.container,
                deployedIn ? 'deployed-in' : 'composed-of'
            );
            for (const childId of containment.nodes ?? []) {
                parentMap.set(childId, containment.container);
            }
        }
    }

    // Compute descendant counts for dynamic container sizing
    const descendantCount = new Map<string, number>();
    function countDescendants(nodeId: string): number {
        if (descendantCount.has(nodeId)) return descendantCount.get(nodeId)!;
        let count = 0;
        for (const [child, parent] of parentMap.entries()) {
            if (parent === nodeId) {
                count += 1 + countDescendants(child);
            }
        }
        descendantCount.set(nodeId, count);
        return count;
    }
    for (const cId of containerIds) countDescendants(cId);

    // Build nodes
    for (const n of arch.nodes) {
        const id = (n['unique-id'] as string) ?? `node-${nodes.length}`;
        const isContainer = containerIds.has(id);
        const parent = parentMap.get(id);

        const resolvedType = isContainer
            ? 'container'
            : resolveNodeType((n['node-type'] as string) ?? 'system');

        let containerWidth = CONTAINER_BASE_WIDTH;
        let containerHeight = CONTAINER_BASE_HEIGHT;
        if (isContainer) {
            const desc = descendantCount.get(id) ?? 0;
            containerWidth = CONTAINER_BASE_WIDTH + Math.ceil(Math.sqrt(desc)) * CONTAINER_CHILD_WIDTH_INCREMENT;
            containerHeight = CONTAINER_BASE_HEIGHT + Math.ceil(Math.sqrt(desc)) * CONTAINER_CHILD_HEIGHT_INCREMENT;
        }

        const node: Node = {
            id,
            type: resolvedType,
            position: { x: 0, y: 0 },
            data: {
                label: n.name ?? id,
                calmId: id,
                calmType: n['node-type'] ?? 'system',
                description: n.description ?? '',
                interfaces: n.interfaces,
                controls: n.controls,
                details: n.details,
                metadata: n.metadata,
                containmentType: containerVariant.get(id),
            },
            ...(parent ? { parentId: parent, extent: 'parent' as const } : {}),
            ...(isContainer
                ? {
                      style: { width: containerWidth, height: containerHeight },
                  }
                : {}),
            width: isContainer ? containerWidth : NODE_WIDTH,
            height: isContainer ? containerHeight : NODE_HEIGHT,
        };

        nodes.push(node);
    }

    // Build edges from non-containment relationships
    interface ConnectsEntry { relId: string; src: string; dst: string; protocol?: string; description?: string; controls?: unknown; lineStyle: string; edgeMetadata: Record<string, unknown> }
    const connectsList: ConnectsEntry[] = [];
    for (const rel of arch.relationships ?? []) {
        const rt = rel['relationship-type'] as
            | Record<string, unknown>
            | undefined;
        if (!rt) continue;
        const relId = (rel['unique-id'] as string) ?? `edge-${edges.length}`;

        const connects = rt.connects as
            | { source?: { node?: string }; destination?: { node?: string } }
            | undefined;
        const interacts = rt.interacts as
            | { actor?: string; nodes?: string[] }
            | undefined;

        if (connects) {
            const src = connects.source?.node;
            const dst = connects.destination?.node;
            if (src && dst) {
                const protocol = (rel as any).protocol as string | undefined;
                const description = (rel as any).description as
                    | string
                    | undefined;
                const relMeta = (rel as any).metadata as Record<string, unknown> | undefined;
                const lineStyle = (relMeta?.['line-style'] as string) ?? 'solid';
                const edgeMetadata: Record<string, unknown> = {};
                if (relMeta) { for (const [k, v] of Object.entries(relMeta)) { if (k !== 'line-style') edgeMetadata[k] = v; } }
                connectsList.push({ relId, src, dst, protocol, description, controls: (rel as any).controls, lineStyle, edgeMetadata });
            }
        } else if (interacts) {
            const actor = interacts.actor;
            const description = (rel as any).description as string | undefined;
            const relMeta = (rel as any).metadata as Record<string, unknown> | undefined;
            const lineStyle = (relMeta?.['line-style'] as string) ?? 'solid';
            const edgeMetadata: Record<string, unknown> = {};
            if (relMeta) { for (const [k, v] of Object.entries(relMeta)) { if (k !== 'line-style') edgeMetadata[k] = v; } }
            for (const target of interacts.nodes ?? []) {
                if (actor && target) {
                    edges.push({
                        id: `${relId}#${target}`,
                        source: actor,
                        target,
                        label: description || undefined,
                        data: {
                            calmVariant: 'interacts',
                            calmRelId: relId,
                            description,
                            direction: 'source-to-target',
                            lineStyle,
                            edgeMetadata,
                        },
                        type: 'tooltip',
                        markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15 },
                        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
                    });
                }
            }
        }
    }

    // Detect bidirectional connects pairs (A→B + B→A) and merge into single edge
    const consumed = new Set<string>();
    for (const entry of connectsList) {
        if (consumed.has(entry.relId)) continue;
        const reverse = connectsList.find(
            (e) => !consumed.has(e.relId) && e.relId !== entry.relId && e.src === entry.dst && e.dst === entry.src
        );
        const isBidi = !!reverse;
        if (reverse) consumed.add(reverse.relId);
        consumed.add(entry.relId);

        const directionValue = isBidi ? 'bidirectional' : 'source-to-target';
        const markerEnd = { type: MarkerType.ArrowClosed, width: 15, height: 15 };
        const markerStart = isBidi ? { type: MarkerType.ArrowClosed, width: 15, height: 15 } : undefined;

        edges.push({
            id: entry.relId,
            source: entry.src,
            target: entry.dst,
            label: entry.protocol || entry.description || undefined,
            data: {
                calmVariant: 'connects',
                calmRelId: entry.relId,
                calmReverseRelId: reverse?.relId,
                protocol: entry.protocol,
                description: entry.description,
                controls: entry.controls,
                direction: directionValue,
                lineStyle: entry.lineStyle,
                edgeMetadata: entry.edgeMetadata,
            },
            type: 'tooltip',
            markerEnd,
            markerStart,
            style: { stroke: '#94a3b8', strokeWidth: 1.5 },
        });
    }

    // Apply Dagre auto-layout
    const layoutedNodes = applyDagreLayout(nodes, edges, direction);
    return { nodes: layoutedNodes, edges };
}

const KNOWN_NODE_TYPES = new Set([
    'service',
    'actor',
    'database',
    'container',
    'webclient',
    'system',
    'ecosystem',
    'network',
    'ldap',
    'data-asset',
]);

function resolveNodeType(calmType: string): string {
    const lower = calmType.toLowerCase();
    if (KNOWN_NODE_TYPES.has(lower)) return lower;
    if (lower === 'datastore' || lower === 'data-store') return 'database';
    if (calmType.includes(':')) return 'extension';
    return 'system';
}

function applyDagreLayout(
    nodes: Node[],
    edges: Edge[],
    direction: 'DOWN' | 'RIGHT' = 'DOWN'
): Node[] {
    try {
        return applyDagreLayoutInner(nodes, edges, direction);
    } catch (err) {
        console.warn('[CALM Canvas] Dagre layout failed, using fallback grid:', err);
        return applyFallbackLayout(nodes);
    }
}

function applyDagreLayoutInner(
    nodes: Node[],
    edges: Edge[],
    direction: 'DOWN' | 'RIGHT' = 'DOWN'
): Node[] {
    const g = new dagre.graphlib.Graph({ compound: true });
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: direction === 'RIGHT' ? 'LR' : 'TB',
        ranksep: 120,
        nodesep: 80,
        edgesep: 40,
    });

    // Add all nodes to graph
    for (const node of nodes) {
        const w = node.width ?? NODE_WIDTH;
        const h = node.height ?? NODE_HEIGHT;
        g.setNode(node.id, { width: w, height: h });
        if (node.parentId) {
            g.setParent(node.id, node.parentId);
        }
    }

    // Add edges (only non-containment)
    for (const edge of edges) {
        if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
            g.setEdge(edge.source, edge.target);
        }
    }

    dagre.layout(g);

    const positioned = nodes.map((node) => {
        const pos = g.node(node.id);
        if (!pos) return node;

        const w = node.width ?? NODE_WIDTH;
        const h = node.height ?? NODE_HEIGHT;

        // Dagre gives center position; ReactFlow uses top-left
        let x = pos.x - w / 2;
        let y = pos.y - h / 2;

        // If child of a container, position relative to parent
        if (node.parentId) {
            const parentPos = g.node(node.parentId);
            if (parentPos) {
                const pw =
                    nodes.find((n) => n.id === node.parentId)?.width ?? 400;
                const ph =
                    nodes.find((n) => n.id === node.parentId)?.height ?? 300;
                x = pos.x - parentPos.x + pw / 2 - w / 2;
                y = pos.y - parentPos.y + ph / 2 - h / 2;
            }
        }

        return { ...node, position: { x, y } };
    });

    // Clamp children so they stay within parent bounds (with padding)
    return positioned.map((node) => {
        if (!node.parentId) return node;
        const parent = positioned.find((n) => n.id === node.parentId);
        if (!parent) return node;
        const pw = parent.width ?? CONTAINER_BASE_WIDTH;
        const ph = parent.height ?? CONTAINER_BASE_HEIGHT;
        const nw = node.width ?? NODE_WIDTH;
        const nh = node.height ?? NODE_HEIGHT;
        const x = Math.max(GROUP_PADDING, Math.min(node.position.x, pw - nw - GROUP_PADDING));
        const y = Math.max(GROUP_PADDING + 30, Math.min(node.position.y, ph - nh - GROUP_PADDING));
        return { ...node, position: { x, y } };
    });
}

function applyFallbackLayout(nodes: Node[]): Node[] {
    const topLevel = nodes.filter((n) => !n.parentId);
    const childrenByParent = new Map<string, Node[]>();
    for (const node of nodes) {
        if (node.parentId) {
            const siblings = childrenByParent.get(node.parentId) ?? [];
            siblings.push(node);
            childrenByParent.set(node.parentId, siblings);
        }
    }

    // Layout top-level nodes in a grid
    const cols = Math.ceil(Math.sqrt(topLevel.length));
    const posMap = new Map<string, { x: number; y: number }>();
    topLevel.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const w = node.width ?? NODE_WIDTH;
        const h = node.height ?? NODE_HEIGHT;
        posMap.set(node.id, { x: col * (w + 80), y: row * (h + 80) });
    });

    // Layout children in a grid within their parent
    for (const [parentId, children] of childrenByParent) {
        const parent = nodes.find((n) => n.id === parentId);
        const pw = parent?.width ?? CONTAINER_BASE_WIDTH;
        const childCols = Math.ceil(Math.sqrt(children.length));
        children.forEach((child, i) => {
            const col = i % childCols;
            const row = Math.floor(i / childCols);
            const cw = child.width ?? NODE_WIDTH;
            const ch = child.height ?? NODE_HEIGHT;
            const spacing = Math.min((pw - GROUP_PADDING * 2) / childCols, cw + 40);
            posMap.set(child.id, {
                x: GROUP_PADDING + col * spacing,
                y: GROUP_PADDING + 30 + row * (ch + 40),
            });
        });
    }

    return nodes.map((node) => ({
        ...node,
        position: posMap.get(node.id) ?? { x: 0, y: 0 },
    }));
}
