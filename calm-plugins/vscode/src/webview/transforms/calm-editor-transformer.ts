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
    const originalNodes = new Map((lastParsedArch?.nodes ?? []).map((n) => [n['unique-id'] as string, n]));
    const originalRels = new Map((lastParsedArch?.relationships ?? []).map((r) => [r['unique-id'] as string, r]));

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
        const id = (data.calmId ?? n.id) as string;
        let controls: unknown;
        if (data.controls && Object.keys(data.controls as object).length > 0) {
            // For ref-based nodes: only save requirement-url + config (strip resolved descriptions)
            controls = data['definition-id']
                ? stripResolvedNoise(data.controls as Record<string, unknown>)
                : data.controls;
        }
        calmNodes.push(applyCanvasFields(originalNodes.get(id), {
            'unique-id': id,
            'node-type': data.calmType ?? n.type ?? 'system',
            name: data.label ?? '',
            description: data.description ?? '',
            'definition-id': data['definition-id'] || undefined,
            interfaces: data.interfaces || undefined,
            controls,
            details: data.details || undefined,
            metadata: data.metadata || undefined,
        }));
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
        const originalInner = originalVariant(existingRel, variant);
        calmRelationships.push(applyCanvasFields(existingRel, {
            'unique-id': relId,
            'relationship-type': {
                [variant]: { ...originalInner, container: parentId, nodes: inOriginalOrder(children, originalInner?.nodes) },
            },
        }));
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
                existing.targets.push(edge.target);
            } else {
                interactsGroups.set(relId, { actor: edge.source, targets: [edge.target], data, edge });
            }
            continue;
        }

        const direction = (data.direction as string) ?? 'source-to-target';
        const original = originalRels.get(relId);
        const metadata = buildEdgeMetadata(data, original);

        calmRelationships.push(applyCanvasFields(original, {
            'unique-id': relId,
            'relationship-type': buildRelationshipType(variant, edge.source, edge.target, original),
            protocol: data.protocol || undefined,
            description: data.description || undefined,
            controls: data.controls || undefined,
            metadata,
        }));

        // Bidirectional: emit a second relationship in the reverse direction
        if (direction === 'bidirectional' && variant === 'connects') {
            const reverseId = (data.calmReverseRelId as string) ?? `${relId}-reverse`;
            const reverseOriginal = originalRels.get(reverseId);
            calmRelationships.push(applyCanvasFields(reverseOriginal, {
                'unique-id': reverseId,
                'relationship-type': buildRelationshipType(variant, edge.target, edge.source, reverseOriginal),
                protocol: data.protocol || undefined,
                description: data.description || undefined,
                metadata,
            }));
        }
    }

    // Emit grouped interacts relationships
    for (const [relId, group] of interactsGroups) {
        const data = group.data;
        const original = originalRels.get(relId);
        calmRelationships.push(applyCanvasFields(original, {
            'unique-id': relId,
            'relationship-type': {
                interacts: { ...originalVariant(original, 'interacts'), actor: group.actor, nodes: group.targets },
            },
            protocol: data.protocol || undefined,
            description: data.description || undefined,
            controls: data.controls || undefined,
            metadata: buildEdgeMetadata(data, original),
        }));
    }

    // Passthrough: relationships that the canvas does not draw must be kept verbatim
    if (lastParsedArch) {
        const emittedIds = new Set(calmRelationships.map((r) => r['unique-id'] as string));
        for (const rel of lastParsedArch.relationships) {
            if (emittedIds.has(rel['unique-id'] as string)) continue;
            if (!isDrawnOnCanvas(rel)) calmRelationships.push(rel);
        }
    }

    // Keep the document order, so that an unchanged document gives the same text
    const relOrder = new Map((lastParsedArch?.relationships ?? []).map((r, i) => [r['unique-id'] as string, i]));
    calmRelationships.sort((a, b) =>
        (relOrder.get(a['unique-id'] as string) ?? Infinity) - (relOrder.get(b['unique-id'] as string) ?? Infinity));

    const arch: CalmArchitecture = { ...lastParsedArch, nodes: calmNodes, relationships: calmRelationships };

    if (documentControls && Object.keys(documentControls).length > 0) {
        arch.controls = documentControls;
    } else {
        delete arch.controls;
    }

    // Persist layout
    const layout = buildLayoutMap(nodes);
    const rawMetadata = lastParsedArch?.metadata as Record<string, unknown> | undefined;
    const existingMetadata = (rawMetadata && typeof rawMetadata === 'object' && !Array.isArray(rawMetadata)) ? rawMetadata : {};
    arch.metadata = { ...existingMetadata, _layout: layout };

    return arch;
}

/** Fields the canvas edits replace those of the original (undefined removes one); all other fields stay. */
function applyCanvasFields(
    original: Record<string, unknown> | undefined,
    canvasFields: Record<string, unknown>,
): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...original };
    for (const [key, value] of Object.entries(canvasFields)) {
        if (value === undefined) delete merged[key];
        else merged[key] = value;
    }
    return merged;
}

function originalVariant(
    rel: Record<string, unknown> | undefined,
    variant: string,
): Record<string, unknown> | undefined {
    const rt = rel?.['relationship-type'] as Record<string, unknown> | undefined;
    return rt?.[variant] as Record<string, unknown> | undefined;
}

function inOriginalOrder(ids: string[], originalIds: unknown): string[] {
    if (!Array.isArray(originalIds)) return ids;
    const order = new Map(originalIds.map((id, i) => [id as string, i]));
    return [...ids].sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
}

function buildEdgeMetadata(
    data: Record<string, unknown>,
    original: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
    const lineStyle = (data.lineStyle as string) ?? 'solid';
    const routing = (data.routing as string) ?? 'bezier';
    const meta: Record<string, unknown> = { ...((data.edgeMetadata as Record<string, unknown>) ?? {}) };
    if (lineStyle && lineStyle !== 'solid') meta['line-style'] = lineStyle;
    if (routing && routing !== 'bezier') meta['routing'] = routing;
    if (Object.keys(meta).length === 0) return undefined;
    // The parser holds line-style and routing apart from the other metadata, so put them back where they were
    const originalKeys = Object.keys((original?.metadata as Record<string, unknown> | undefined) ?? {});
    return { ...Object.fromEntries(originalKeys.filter((k) => k in meta).map((k) => [k, meta[k]])), ...meta };
}

function buildRelationshipType(
    variant: string,
    source: string,
    target: string,
    original: Record<string, unknown> | undefined,
): Record<string, unknown> {
    const inner = originalVariant(original, variant);
    return {
        [variant]: {
            ...inner,
            source: endpoint(inner?.source, source),
            destination: endpoint(inner?.destination, target),
        },
    };
}

// Interfaces belong to the node, so a reconnected end loses them
function endpoint(original: unknown, node: string): Record<string, unknown> {
    const end = original as Record<string, unknown> | undefined;
    return end?.node === node ? { ...end } : { node };
}

/** Mirrors parseCALMData: a relationship it does not draw has no edge or container to write it back from. */
function isDrawnOnCanvas(rel: Record<string, unknown>): boolean {
    const rt = rel['relationship-type'] as Record<string, unknown> | undefined;
    if (!rt) return false;
    if (rt['deployed-in'] || rt['composed-of']) return true;
    const interacts = rt.interacts as { actor?: string; nodes?: string[] } | undefined;
    if (!rt.connects && interacts) return !!interacts.actor && (interacts.nodes ?? []).some(Boolean);
    const variantKey = rt.connects ? 'connects' : Object.keys(rt)[0];
    const inner = rt[variantKey] as { source?: { node?: string }; destination?: { node?: string } } | undefined;
    return !!inner?.source?.node && !!inner?.destination?.node;
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
