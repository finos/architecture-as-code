import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js';
import type { LensEdge, LensGroup, LensLayout, LensNode, LensReply, Port, Shape } from '../../model/lens.js';
import type { Theme } from '../../theme/useTheme.js';
import { FONT_SIZE, LINE_HEIGHT, fitShape, portPoint, textWidth, wrap, type Fitted } from './geometry.js';
import {
    elementStyle, findShape, groupStyle, relationshipStyle,
    type ComputedElementStyle, type ComputedGroupStyle, type ComputedRelationshipStyle, type ResolvedNotation,
} from './styles.js';

export interface PlacedNode {
    node: LensNode;
    style: ComputedElementStyle;
    shape: Shape;
    fit: Fitted;
    x: number;
    y: number;
}

export interface PlacedGroup {
    group: LensGroup;
    style: ComputedGroupStyle;
    depth: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PlacedEdge {
    edge: LensEdge;
    style: ComputedRelationshipStyle;
    points: { x: number; y: number }[];
    label: string[];
    /** The centre of the label, where ELK made room for it. Else the label goes at the middle of the line. */
    labelAt?: { x: number; y: number };
}

export interface Layout {
    width: number;
    height: number;
    groups: PlacedGroup[];
    nodes: PlacedNode[];
    edges: PlacedEdge[];
}

/** Space around a group's members: room for its label at the top. */
export const GROUP_PADDING = { top: 32, right: 16, bottom: 16, left: 16 };
const MARGIN = 24;
const EDGE_LABEL = { size: FONT_SIZE.small, width: 160 };
export const LAYOUT_TIME_LIMIT_MS = 10_000;

const ALGORITHMS: Record<Exclude<LensLayout['algorithm'], 'fixed'>, string> = {
    layered: 'layered', tree: 'mrtree', radial: 'radial', force: 'force', stress: 'stress', rectpacking: 'rectpacking', box: 'box',
};

function layoutOptions(layout: LensLayout | undefined): Record<string, string> {
    const algorithm = layout?.algorithm === 'fixed' ? 'layered' : (layout?.algorithm ?? 'layered');
    const spacing = layout?.spacing ?? 50;
    return {
        'elk.algorithm': ALGORITHMS[algorithm],
        'elk.direction': (layout?.direction ?? 'down').toUpperCase(),
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing * 1.2),
        'elk.spacing.edgeLabel': '4',
        'elk.edgeLabels.placement': 'CENTER',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    };
}

/** The lines of an edge label: the label, then the technology in brackets, as C4 and Structurizr show it. */
export function edgeLabel(edge: LensEdge): string[] {
    const text = [edge.label, edge.technology ? `[${edge.technology}]` : undefined].filter(Boolean).join('\n');
    return text ? wrap(text, EDGE_LABEL.width, EDGE_LABEL.size).filter(Boolean) : [];
}

interface Prepared {
    nodes: PlacedNode[];
    groups: PlacedGroup[];
    edges: PlacedEdge[];
    ports: Map<string, Port[]>;
}

function prepare(reply: LensReply, notation: ResolvedNotation, theme: Theme): Prepared {
    const { nodes, groups, edges } = reply.graph;
    const parent = new Map(groups.map((group) => [group.id, group.parent]));
    const depth = (id: string | undefined): number => (id === undefined ? 0 : 1 + depth(parent.get(id)));
    const ports = new Map<string, Port[]>();
    return {
        groups: groups.map((group) => ({ group, style: groupStyle(notation, group.tags ?? [], theme), depth: depth(group.parent), x: 0, y: 0, width: 0, height: 0 })),
        nodes: nodes.map((node) => {
            const style = elementStyle(notation, node.tags ?? [], theme);
            const shape = findShape(notation, style.shape)!;
            if (Array.isArray(shape.ports)) ports.set(node.id, shape.ports);
            return { node, style, shape, fit: fitShape(shape, node, style), x: 0, y: 0 };
        }),
        edges: edges.map((edge) => ({ edge, style: relationshipStyle(notation, edge.tags ?? [], theme), points: [], label: edgeLabel(edge) })),
        ports,
    };
}

/**
 * Lays out a lens reply: ELK for the graph and each group, or the author's positions with the `fixed` layout. Each
 * node takes the size of its shape, fitted to its text.
 */
export async function layoutLens(reply: LensReply, notation: ResolvedNotation, theme: Theme, elk: () => Promise<ELK>): Promise<Layout> {
    const prepared = prepare(reply, notation, theme);
    if (reply.layout?.algorithm === 'fixed') placeFixed(prepared);
    else await placeWithElk(prepared, reply, await elk());
    return finish(prepared);
}

async function placeWithElk(prepared: Prepared, reply: LensReply, elk: ELK) {
    const { nodes, groups, edges, ports } = prepared;
    // ELK sees index ids only, so an author's id cannot clash with a port id or an ELK option.
    const elkId = new Map<string, string>();
    groups.forEach(({ group }, index) => elkId.set(group.id, `g${index}`));
    nodes.forEach(({ node }, index) => elkId.set(node.id, `n${index}`));
    const elkNodes = new Map<string, ElkNode>();
    for (const { node, fit } of nodes) {
        const own = ports.get(node.id);
        elkNodes.set(node.id, {
            id: elkId.get(node.id)!,
            width: fit.width,
            height: fit.height,
            ...(own && {
                layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
                ports: own.map((port) => {
                    const at = portPoint(port, fit.width, fit.height);
                    return { id: `${elkId.get(node.id)}.${port.id}`, ...at, width: 0, height: 0, layoutOptions: { 'elk.port.side': SIDE[port.side] } };
                }),
            }),
        });
    }
    const ownLayout = groups.some(({ group }) => group.layout);
    for (const { group } of groups) {
        elkNodes.set(group.id, {
            id: elkId.get(group.id)!,
            children: [],
            layoutOptions: {
                ...(group.layout && layoutOptions(group.layout)),
                'elk.padding': `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.left},bottom=${GROUP_PADDING.bottom},right=${GROUP_PADDING.right}]`,
            },
        });
    }
    const root: ElkNode = {
        id: 'root',
        children: [],
        layoutOptions: {
            ...layoutOptions(reply.layout),
            // A group with its own algorithm needs its own pass, and ELK then does not route the edges that leave it.
            'elk.hierarchyHandling': ownLayout ? 'SEPARATE_CHILDREN' : 'INCLUDE_CHILDREN',
        },
        edges: [],
    };
    const container = (id: string | undefined) => (id === undefined ? root : elkNodes.get(id)!);
    for (const { group } of groups) container(group.parent).children!.push(elkNodes.get(group.id)!);
    for (const { node } of nodes) container(node.group).children!.push(elkNodes.get(node.id)!);
    const isGroup = new Set(groups.map(({ group }) => group.id));
    edges.forEach(({ edge, label }, index) => {
        // ELK refuses an edge between a group and its own members, so an edge that joins a group is drawn direct.
        if (isGroup.has(edge.source) || isGroup.has(edge.target)) return;
        const end = (id: string, port: string | undefined) =>
            port && ports.get(id)?.some((entry) => entry.id === port) ? `${elkId.get(id)}.${port}` : elkId.get(id)!;
        const elkEdge: ElkExtendedEdge = {
            id: `e${index}`,
            sources: [end(edge.source, edge.sourcePort)],
            targets: [end(edge.target, edge.targetPort)],
            // ELK places a label only when it has text.
            labels: label.length
                ? [{ text: label.join(' '), width: Math.max(...label.map((line) => textWidth(line, EDGE_LABEL.size))), height: label.length * EDGE_LABEL.size * LINE_HEIGHT }]
                : [],
        };
        root.edges!.push(elkEdge);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new LayoutTimeout()), LAYOUT_TIME_LIMIT_MS);
    });
    const result = await Promise.race([elk.layout(root), limit]).finally(() => clearTimeout(timer));

    const offsets = new Map<string, { x: number; y: number }>([['root', { x: 0, y: 0 }]]);
    const byElkId = new Map<string, { x: number; y: number; width: number; height: number }>();
    const walk = (node: ElkNode, ox: number, oy: number) => {
        for (const child of node.children ?? []) {
            const x = ox + (child.x ?? 0), y = oy + (child.y ?? 0);
            byElkId.set(child.id, { x, y, width: child.width ?? 0, height: child.height ?? 0 });
            offsets.set(child.id, { x, y });
            walk(child, x, y);
        }
    };
    walk(result, 0, 0);
    for (const placed of nodes) Object.assign(placed, pick(byElkId.get(elkId.get(placed.node.id)!)));
    for (const placed of groups) Object.assign(placed, byElkId.get(elkId.get(placed.group.id)!));
    const elkEdges = new Map((result.edges ?? []).map((edge) => [edge.id, edge]));
    edges.forEach((placed, index) => {
        const routed = elkEdges.get(`e${index}`);
        const section = routed?.sections?.[0];
        if (!section || placed.style.routing === 'direct') return;
        const offset = offsets.get(routed.container ?? 'root') ?? { x: 0, y: 0 };
        placed.points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint].map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
        const label = routed.labels?.[0];
        if (label?.x !== undefined && label.y !== undefined) {
            placed.labelAt = { x: label.x + offset.x + (label.width ?? 0) / 2, y: label.y + offset.y + (label.height ?? 0) / 2 };
        }
    });
}

const pick = (box: { x: number; y: number } | undefined) => ({ x: box?.x ?? 0, y: box?.y ?? 0 });

const SIDE: Record<Port['side'], string> = { top: 'NORTH', right: 'EAST', bottom: 'SOUTH', left: 'WEST' };

export class LayoutTimeout extends Error {
    constructor() {
        super(`The layout took longer than ${LAYOUT_TIME_LIMIT_MS / 1000} s.`);
    }
}

/** The fixed layout: each node at the position that the author sends. A group fits around its members. */
function placeFixed({ nodes, groups }: Prepared) {
    let nextX = 0;
    for (const placed of nodes) {
        const position = placed.node.position;
        // A node with no position goes in a row, so that it is still visible.
        if (position) Object.assign(placed, position);
        else {
            Object.assign(placed, { x: nextX, y: -placed.fit.height - 80 });
            nextX += placed.fit.width + 40;
        }
    }
    for (const placed of [...groups].sort((a, b) => b.depth - a.depth)) {
        const members = [
            ...nodes.filter(({ node }) => node.group === placed.group.id).map(({ x, y, fit }) => ({ x, y, width: fit.width, height: fit.height })),
            ...groups.filter(({ group }) => group.parent === placed.group.id),
        ];
        if (members.length === 0) {
            Object.assign(placed, { ...(placed.group.position ?? { x: 0, y: 0 }), width: 160, height: GROUP_PADDING.top + GROUP_PADDING.bottom });
            continue;
        }
        const left = Math.min(...members.map((m) => m.x)) - GROUP_PADDING.left;
        const top = Math.min(...members.map((m) => m.y)) - GROUP_PADDING.top;
        const right = Math.max(...members.map((m) => m.x + m.width)) + GROUP_PADDING.right;
        const bottom = Math.max(...members.map((m) => m.y + m.height)) + GROUP_PADDING.bottom;
        Object.assign(placed, { x: left, y: top, width: right - left, height: bottom - top });
    }
}

interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** The point where the line from the centre of the box towards `toward` leaves the box. */
export function exitPoint(box: Box, toward: { x: number; y: number }): { x: number; y: number } {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const dx = toward.x - cx, dy = toward.y - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const scale = Math.min(dx === 0 ? Infinity : box.width / 2 / Math.abs(dx), dy === 0 ? Infinity : box.height / 2 / Math.abs(dy));
    return { x: cx + dx * scale, y: cy + dy * scale };
}

/** Draws each edge that has no route as a straight line between the outlines, or the ports, of its ends. */
function finish({ nodes, groups, edges, ports }: Prepared): Layout {
    const boxes = new Map<string, Box>();
    for (const { node, x, y, fit } of nodes) boxes.set(node.id, { x, y, width: fit.width, height: fit.height });
    for (const { group, x, y, width, height } of groups) boxes.set(group.id, { x, y, width, height });
    for (const placed of edges) {
        if (placed.points.length >= 2) continue;
        const { edge } = placed;
        const from = boxes.get(edge.source)!, to = boxes.get(edge.target)!;
        const port = (id: string, name: string | undefined, box: Box) => {
            const found = name ? ports.get(id)?.find((entry) => entry.id === name) : undefined;
            if (!found) return undefined;
            const at = portPoint(found, box.width, box.height);
            return { x: box.x + at.x, y: box.y + at.y };
        };
        const centre = (box: Box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
        const start = port(edge.source, edge.sourcePort, from);
        const end = port(edge.target, edge.targetPort, to);
        placed.points = [start ?? exitPoint(from, end ?? centre(to)), end ?? exitPoint(to, start ?? centre(from))];
    }
    const extents = [
        ...nodes.map(({ x, y, fit }) => ({ x, y, width: fit.width, height: fit.height })),
        ...groups,
        ...edges.flatMap(({ points }) => points.map((point) => ({ ...point, width: 0, height: 0 }))),
    ];
    const left = Math.min(0, ...extents.map((box) => box.x)) - MARGIN;
    const top = Math.min(0, ...extents.map((box) => box.y)) - MARGIN;
    const right = Math.max(0, ...extents.map((box) => box.x + box.width)) + MARGIN;
    const bottom = Math.max(0, ...extents.map((box) => box.y + box.height)) + MARGIN;
    // Move the drawing so that it starts at 0,0: the SVG viewBox and the zoom then need no offset.
    const shift = <T extends { x: number; y: number }>(item: T) => Object.assign(item, { x: item.x - left, y: item.y - top });
    nodes.forEach(shift);
    groups.forEach(shift);
    edges.forEach(({ points, labelAt }) => [...points, ...(labelAt ? [labelAt] : [])].forEach(shift));
    return {
        width: right - left,
        height: bottom - top,
        nodes,
        // Outer groups first, so that an inner group draws on top.
        groups: [...groups].sort((a, b) => a.depth - b.depth),
        edges,
    };
}
