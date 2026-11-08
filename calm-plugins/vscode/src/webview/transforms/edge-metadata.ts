export interface EdgeMetadataFields {
    lineStyle: string;
    routing: string;
    edgeMetadata: Record<string, unknown>;
}

/** The canvas holds line-style and routing apart from the other metadata of a relationship. */
export function splitEdgeMetadata(metadata: unknown): EdgeMetadataFields {
    const { 'line-style': lineStyle, routing, ...edgeMetadata } = (metadata ?? {}) as Record<string, unknown>;
    return {
        lineStyle: (lineStyle as string | undefined) ?? 'solid',
        routing: (routing as string | undefined) ?? 'bezier',
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
    if (lineStyle === parsed.lineStyle && routing === parsed.routing
        && JSON.stringify(edgeMetadata) === JSON.stringify(parsed.edgeMetadata)) {
        return originalMetadata as Record<string, unknown> | unknown[] | undefined;
    }
    const meta: Record<string, unknown> = { ...edgeMetadata };
    if (lineStyle && lineStyle !== 'solid') meta['line-style'] = lineStyle;
    if (routing && routing !== 'bezier') meta['routing'] = routing;
    if (Object.keys(meta).length === 0) return undefined;
    // Put line-style and routing back where they were
    const originalKeys = Object.keys((originalMetadata ?? {}) as Record<string, unknown>);
    return { ...Object.fromEntries(originalKeys.filter((k) => k in meta).map((k) => [k, meta[k]])), ...meta };
}
