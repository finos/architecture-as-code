export interface EdgeMetadataFields {
    lineStyle: string;
    routing: string;
    sourceHandle?: string;
    targetHandle?: string;
    direction?: string;
    edgeMetadata: Record<string, unknown>;
}

const STYLE_KEYS = ['line-style', 'routing', 'source-handle', 'target-handle', 'direction'];

// In array metadata, the canvas keeps line-style and routing in an element of their own
function isStyleElement(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((k) => STYLE_KEYS.includes(k));
}

/** The canvas holds line-style and routing apart from the other metadata of a relationship. */
export function splitEdgeMetadata(metadata: unknown): EdgeMetadataFields {
    if (Array.isArray(metadata)) {
        const style = Object.assign({}, ...metadata.filter(isStyleElement));
        return {
            ...splitEdgeMetadata(style),
            edgeMetadata: { ...metadata.filter((e) => !isStyleElement(e)) },
        };
    }
    const {
        'line-style': lineStyle, routing, 'source-handle': sourceHandle, 'target-handle': targetHandle, direction, ...edgeMetadata
    } = (metadata ?? {}) as Record<string, unknown>;
    return {
        lineStyle: (lineStyle as string | undefined) ?? 'solid',
        routing: (routing as string | undefined) ?? 'bezier',
        ...(typeof sourceHandle === 'string' ? { sourceHandle } : {}),
        ...(typeof targetHandle === 'string' ? { targetHandle } : {}),
        ...(typeof direction === 'string' ? { direction } : {}),
        edgeMetadata,
    };
}

export function joinEdgeMetadata(
    fields: Partial<EdgeMetadataFields>,
    originalMetadata: unknown,
): Record<string, unknown> | unknown[] | undefined {
    const lineStyle = fields.lineStyle ?? 'solid';
    const routing = fields.routing ?? 'bezier';
    const edgeMetadata = fields.edgeMetadata ?? {};
    // If the canvas did not change the metadata, keep its original form (an array, {}, or explicit defaults)
    const parsed = splitEdgeMetadata(originalMetadata);
    const savedDirection = (direction: string | undefined) => direction === 'none' || direction === 'target-to-source' ? direction : undefined;
    if (lineStyle === parsed.lineStyle && routing === parsed.routing
        && fields.sourceHandle === parsed.sourceHandle && fields.targetHandle === parsed.targetHandle
        && savedDirection(fields.direction) === savedDirection(parsed.direction)
        && JSON.stringify(edgeMetadata) === JSON.stringify(parsed.edgeMetadata)) {
        return originalMetadata as Record<string, unknown> | unknown[] | undefined;
    }
    const style: Record<string, unknown> = {};
    if (lineStyle && lineStyle !== 'solid') style['line-style'] = lineStyle;
    if (routing && routing !== 'bezier') style['routing'] = routing;
    if (fields.sourceHandle) style['source-handle'] = fields.sourceHandle;
    if (fields.targetHandle) style['target-handle'] = fields.targetHandle;
    const direction = savedDirection(fields.direction);
    if (direction) style.direction = direction;
    if (Array.isArray(originalMetadata)) return joinArrayMetadata(edgeMetadata, style);
    const meta: Record<string, unknown> = { ...edgeMetadata, ...style };
    if (Object.keys(meta).length === 0) return undefined;
    // Put line-style and routing back where they were
    const originalKeys = Object.keys((originalMetadata ?? {}) as Record<string, unknown>);
    return { ...Object.fromEntries(originalKeys.filter((k) => k in meta).map((k) => [k, meta[k]])), ...meta };
}

function joinArrayMetadata(edgeMetadata: Record<string, unknown>, style: Record<string, unknown>): unknown[] | undefined {
    const isIndex = (k: string) => /^\d+$/.test(k);
    // The schema needs each element to be an object
    const elements = Object.entries(edgeMetadata).filter(([k]) => isIndex(k))
        .map(([k, v]) => (v && typeof v === 'object' ? v : { [k]: v }));
    // Fields added on the canvas have names, not indexes, so they go into an element of their own
    const added = Object.fromEntries(Object.entries(edgeMetadata).filter(([k]) => !isIndex(k)));
    if (Object.keys(added).length > 0) elements.push(added);
    if (Object.keys(style).length > 0) elements.push(style);
    return elements.length > 0 ? elements : undefined;
}
