import type { Node, Edge } from 'reactflow';

export interface LayoutEntry { x: number; y: number; w?: number; h?: number }
export type LayoutMap = Record<string, LayoutEntry>;

export interface CalmArchitecture {
    nodes: Array<Record<string, unknown>>;
    relationships: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

let lastParsedArch: CalmArchitecture | null = null;

export function setLastParsedArch(arch: CalmArchitecture | null): void {
    lastParsedArch = arch;
}

export function buildLayoutMap(nodes: Node[]): LayoutMap {
    const layout: LayoutMap = {};
    for (const n of nodes) {
        layout[n.id] = {
            x: Math.round(n.position.x),
            y: Math.round(n.position.y),
            w: Math.round((n as any).width ?? (n as any).measured?.width ?? 0),
            h: Math.round((n as any).height ?? (n as any).measured?.height ?? 0),
        };
    }
    return layout;
}

export function applyLayoutFromMetadata(nodes: Node[], metadata: Record<string, unknown> | undefined): Node[] {
    if (!metadata) return nodes;
    const layoutData = metadata._layout as LayoutMap | undefined;
    if (!layoutData) return nodes;
    return nodes.map((n) => {
        const entry = layoutData[n.id];
        if (!entry) return n;
        return {
            ...n,
            position: { x: entry.x, y: entry.y },
            ...(entry.w && entry.h ? { width: entry.w, height: entry.h, style: { ...n.style, width: entry.w, height: entry.h } } : {}),
        };
    });
}

export function flowToCalm(
    nodes: Node[],
    edges: Edge[],
    documentControls?: Record<string, unknown>,
): CalmArchitecture {
    const calmNodes: Array<Record<string, unknown>> = [];
    const calmRelationships: Array<Record<string, unknown>> = [];

    // A node drawn in several containers has one flow node per container, all with the same calmId
    const calmIdOf = new Map(nodes.map((n) => [n.id, ((n.data as Record<string, unknown> | undefined)?.calmId as string) ?? n.id]));
    const toCalmId = (flowId: string) => calmIdOf.get(flowId) ?? flowId;
    const drawnCalmIds = new Set(calmIdOf.values());

    // Reconstruct containment from parentId, including empty containers
    const containerChildren = new Map<string, string[]>();
    for (const n of nodes) {
        if (n.type === 'container' && !containerChildren.has(toCalmId(n.id))) {
            containerChildren.set(toCalmId(n.id), []);
        }
        const otherParents = (((n.data as Record<string, unknown> | undefined)?.otherParents as string[] | undefined) ?? [])
            .filter((p) => drawnCalmIds.has(p));
        for (const parent of [...(n.parentId ? [toCalmId(n.parentId)] : []), ...otherParents]) {
            const children = containerChildren.get(parent) ?? [];
            if (!children.includes(toCalmId(n.id))) children.push(toCalmId(n.id));
            containerChildren.set(parent, children);
        }
    }

    // Build nodes in the order of the file. The canvas puts containers first, which can differ.
    const fileOrder = new Map((lastParsedArch?.nodes ?? []).map((n, i) => [n['unique-id'] as string, i] as const));
    const orderOf = (n: Node) => fileOrder.get(toCalmId(n.id)) ?? Number.MAX_SAFE_INTEGER;
    const writtenIds = new Set<string>();
    for (const n of [...nodes].sort((a, b) => orderOf(a) - orderOf(b))) {
        if (writtenIds.has(toCalmId(n.id))) continue;
        writtenIds.add(toCalmId(n.id));
        const data = (n.data ?? {}) as Record<string, unknown>;
        const calmNode: Record<string, unknown> = {
            'unique-id': data.calmId ?? n.id,
            'node-type': data.calmType ?? n.type ?? 'system',
            name: data.label ?? '',
            description: data.description ?? '',
        };
        if (data['definition-id']) {
            calmNode['definition-id'] = data['definition-id'];
        }
        if (data.interfaces) calmNode.interfaces = data.interfaces;
        if (data.controls && Object.keys(data.controls as object).length > 0) {
            if (data['definition-id']) {
                // For ref-based nodes: only save requirement-url + config (strip resolved descriptions)
                calmNode.controls = stripResolvedNoise(data.controls as Record<string, unknown>);
            } else {
                calmNode.controls = data.controls;
            }
        }
        if (data.details) calmNode.details = data.details;
        if (data.metadata) calmNode.metadata = data.metadata;
        calmNodes.push(calmNode);
    }

    // Build containment relationships in their original order: the parser draws a node with
    // several parents first in the container of its first relationship.
    const originalOrder = (containerId: string) => {
        const index = (lastParsedArch?.relationships ?? []).findIndex((r) => {
            const rt = r['relationship-type'] as Record<string, unknown> | undefined;
            const rel = rt?.['deployed-in'] ?? rt?.['composed-of'];
            return (rel as { container?: string } | undefined)?.container === containerId;
        });
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    const orderedContainers = [...containerChildren].sort(([a], [b]) => originalOrder(a) - originalOrder(b));
    for (const [parentId, children] of orderedContainers) {
        const parentNode = nodes.find((n) => toCalmId(n.id) === parentId);
        const variant = ((parentNode?.data as Record<string, unknown>)?.containmentType as string) ?? 'deployed-in';
        const existingRel = lastParsedArch?.relationships.find((r) => {
            const rt = r['relationship-type'] as Record<string, unknown> | undefined;
            const rel = rt?.['deployed-in'] ?? rt?.['composed-of'];
            return (rel as any)?.container === parentId;
        });
        const relId = (existingRel?.['unique-id'] as string) ?? `containment-${parentId}`;
        calmRelationships.push({
            'unique-id': relId,
            'relationship-type': { [variant]: { container: parentId, nodes: children } },
        });
    }

    // Build edge relationships — group interacts edges by calmRelId
    const interactsGroups = new Map<string, { actor: string; targets: string[]; data: Record<string, unknown>; edge: Edge }>();

    for (const edge of edges) {
        const data = (edge.data ?? {}) as Record<string, unknown>;
        const variant = (data.calmVariant as string) ?? 'connects';
        if (variant === 'deployed-in' || variant === 'composed-of') continue;
        const relId = (data.calmRelId as string) ?? edge.id;

        if (variant === 'interacts') {
            const existing = interactsGroups.get(relId);
            if (existing) {
                existing.targets.push(toCalmId(edge.target));
            } else {
                interactsGroups.set(relId, { actor: toCalmId(edge.source), targets: [toCalmId(edge.target)], data, edge });
            }
            continue;
        }

        const direction = (data.direction as string) ?? 'source-to-target';
        const lineStyle = (data.lineStyle as string) ?? 'solid';
        const routing = (data.routing as string) ?? 'bezier';
        const edgeMetadata = (data.edgeMetadata as Record<string, unknown>) ?? {};
        const meta: Record<string, unknown> = { ...edgeMetadata };
        if (lineStyle && lineStyle !== 'solid') meta['line-style'] = lineStyle;
        if (routing && routing !== 'bezier') meta['routing'] = routing;
        const hasMeta = Object.keys(meta).length > 0;

        const rel: Record<string, unknown> = {
            'unique-id': relId,
            'relationship-type': buildRelationshipType(variant, toCalmId(edge.source), toCalmId(edge.target)),
        };
        if (data.protocol) rel.protocol = data.protocol;
        if (data.description) rel.description = data.description;
        if (data.controls) rel.controls = data.controls;
        if (hasMeta) rel.metadata = meta;
        calmRelationships.push(rel);

        // Bidirectional: emit a second relationship in the reverse direction
        if (direction === 'bidirectional' && variant === 'connects') {
            const reverseId = (data.calmReverseRelId as string) ?? `${relId}-reverse`;
            const reverseRel: Record<string, unknown> = {
                'unique-id': reverseId,
                'relationship-type': buildRelationshipType(variant, toCalmId(edge.target), toCalmId(edge.source)),
            };
            if (data.protocol) reverseRel.protocol = data.protocol;
            if (data.description) reverseRel.description = data.description;
            if (hasMeta) reverseRel.metadata = meta;
            calmRelationships.push(reverseRel);
        }
    }

    // Emit grouped interacts relationships
    for (const [relId, group] of interactsGroups) {
        const data = group.data;
        const lineStyle = (data.lineStyle as string) ?? 'solid';
        const routing = (data.routing as string) ?? 'bezier';
        const edgeMetadata = (data.edgeMetadata as Record<string, unknown>) ?? {};
        const meta: Record<string, unknown> = { ...edgeMetadata };
        if (lineStyle && lineStyle !== 'solid') meta['line-style'] = lineStyle;
        if (routing && routing !== 'bezier') meta['routing'] = routing;
        const hasMeta = Object.keys(meta).length > 0;

        const rel: Record<string, unknown> = {
            'unique-id': relId,
            'relationship-type': { interacts: { actor: group.actor, nodes: group.targets } },
        };
        if (data.description) rel.description = data.description;
        if (data.controls) rel.controls = data.controls;
        if (hasMeta) rel.metadata = meta;
        calmRelationships.push(rel);
    }

    // Passthrough: preserve relationships with unrecognized relationship-types from the
    // original document. The canvas only understands connects, interacts, deployed-in, and
    // composed-of — anything else (custom/decorator types) must be kept verbatim.
    const KNOWN_REL_TYPES = new Set(['connects', 'interacts', 'deployed-in', 'composed-of']);
    if (lastParsedArch) {
        const emittedIds = new Set(calmRelationships.map((r) => r['unique-id'] as string));
        for (const rel of lastParsedArch.relationships) {
            if (emittedIds.has(rel['unique-id'] as string)) continue;
            const rt = rel['relationship-type'] as Record<string, unknown> | undefined;
            if (!rt) continue;
            const keys = Object.keys(rt);
            if (keys.length > 0 && !keys.some((k) => KNOWN_REL_TYPES.has(k))) {
                calmRelationships.push(rel);
            }
        }
    }

    const arch: CalmArchitecture = { nodes: calmNodes, relationships: calmRelationships };

    // Preserve extra fields
    if (lastParsedArch) {
        for (const key of Object.keys(lastParsedArch)) {
            if (key !== 'nodes' && key !== 'relationships' && key !== 'controls' && key !== 'metadata') {
                arch[key] = lastParsedArch[key];
            }
        }
    }

    if (documentControls && Object.keys(documentControls).length > 0) {
        arch.controls = documentControls;
    }

    // Persist layout
    const layout = buildLayoutMap(nodes);
    const rawMetadata = lastParsedArch?.metadata as Record<string, unknown> | undefined;
    const existingMetadata = (rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) ? rawMetadata : {};
    arch.metadata = { ...existingMetadata, _layout: layout };

    return arch;
}

function buildRelationshipType(variant: string, source: string, target: string): Record<string, unknown> {
    switch (variant) {
        case 'interacts': return { interacts: { actor: source, nodes: [target] } };
        case 'connects': return { connects: { source: { node: source }, destination: { node: target } } };
        default: return { [variant]: { source: { node: source }, destination: { node: target } } };
    }
}

function stripResolvedNoise(controls: Record<string, unknown>): Record<string, unknown> {
    const stripped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(controls)) {
        const ctrl = value as Record<string, unknown> | undefined;
        if (!ctrl) continue;
        const clean: Record<string, unknown> = {};
        if (ctrl.description) clean.description = ctrl.description;
        if (ctrl.requirements && Array.isArray(ctrl.requirements)) {
            clean.requirements = (ctrl.requirements as Array<Record<string, unknown>>).map((req) => {
                const r: Record<string, unknown> = {};
                if (req['requirement-url']) r['requirement-url'] = req['requirement-url'];
                if (req['config-url']) r['config-url'] = req['config-url'];
                if (req.config) r.config = req.config;
                return r;
            });
        }
        if (Object.keys(clean).length > 0) {
            stripped[key] = clean;
        }
    }
    return stripped;
}
