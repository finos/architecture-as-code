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

    // Reconstruct containment from parentId, including empty containers
    const containerChildren = new Map<string, string[]>();
    for (const n of nodes) {
        if (n.type === 'container') {
            if (!containerChildren.has(n.id)) containerChildren.set(n.id, []);
        }
        if (n.parentId) {
            if (!containerChildren.has(n.parentId)) containerChildren.set(n.parentId, []);
            containerChildren.get(n.parentId)!.push(n.id);
        }
    }

    // Build nodes
    for (const n of nodes) {
        const data = (n.data ?? {}) as Record<string, unknown>;
        const calmNode: Record<string, unknown> = {
            'unique-id': data.calmId ?? n.id,
            'node-type': data.calmType ?? n.type ?? 'system',
            name: data.label ?? '',
            description: data.description ?? '',
        };
        if (data.interfaces) calmNode.interfaces = data.interfaces;
        if (data.controls) calmNode.controls = data.controls;
        if (data.details) calmNode.details = data.details;
        if (data.metadata) calmNode.metadata = data.metadata;
        calmNodes.push(calmNode);
    }

    // Build containment relationships
    for (const [parentId, children] of containerChildren) {
        const parentNode = nodes.find((n) => n.id === parentId);
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

    // Build edge relationships
    for (const edge of edges) {
        const data = (edge.data ?? {}) as Record<string, unknown>;
        const variant = (data.calmVariant as string) ?? 'connects';
        if (variant === 'deployed-in' || variant === 'composed-of') continue;
        const relId = (data.calmRelId as string) ?? edge.id;
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
            'relationship-type': buildRelationshipType(variant, edge.source, edge.target),
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
                'relationship-type': buildRelationshipType(variant, edge.target, edge.source),
            };
            if (data.protocol) reverseRel.protocol = data.protocol;
            if (data.description) reverseRel.description = data.description;
            if (hasMeta) reverseRel.metadata = meta;
            calmRelationships.push(reverseRel);
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
        default: return { connects: { source: { node: source }, destination: { node: target } } };
    }
}
