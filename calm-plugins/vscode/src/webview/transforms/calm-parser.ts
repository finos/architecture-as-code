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

    // Build nodes
    for (const n of arch.nodes) {
        const id = (n['unique-id'] as string) ?? `node-${nodes.length}`;
        const isContainer = containerIds.has(id);
        const parent = parentMap.get(id);

        const resolvedType = isContainer
            ? 'container'
            : resolveNodeType((n['node-type'] as string) ?? 'system');

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
                      style: { width: 500, height: 350 },
                  }
                : {}),
            width: isContainer ? 500 : NODE_WIDTH,
            height: isContainer ? 350 : NODE_HEIGHT,
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

    return nodes.map((node) => {
        const positioned = g.node(node.id);
        if (!positioned) return node;

        const w = node.width ?? NODE_WIDTH;
        const h = node.height ?? NODE_HEIGHT;

        // Dagre gives center position; ReactFlow uses top-left
        let x = positioned.x - w / 2;
        let y = positioned.y - h / 2;

        // If child of a container, position relative to parent
        if (node.parentId) {
            const parentPos = g.node(node.parentId);
            if (parentPos) {
                const pw =
                    nodes.find((n) => n.id === node.parentId)?.width ?? 400;
                const ph =
                    nodes.find((n) => n.id === node.parentId)?.height ?? 300;
                x = positioned.x - parentPos.x + pw / 2 - w / 2;
                y = positioned.y - parentPos.y + ph / 2 - h / 2;
            }
        }

        return { ...node, position: { x, y } };
    });
}
