export function isBuildingBlock(data: Record<string, unknown>): boolean {
    const metadata = data.metadata as Record<string, unknown> | undefined;
    return !!metadata?.['source-building-block'] || !!metadata?.['source-fidelity-node'];
}

/** User-defined per-node appearance overrides, persisted under `metadata['building-block-style']`. */
export interface NodeStyleOverride {
    background?: string;
    text?: string;
}

export function getNodeStyleOverride(
    data: Record<string, unknown>
): NodeStyleOverride {
    const metadata = data.metadata as Record<string, unknown> | undefined;
    const style = (metadata?.['building-block-style'] ?? metadata?.['fidelity-style']) as
        | Record<string, unknown>
        | undefined;
    if (!style || typeof style !== 'object') return {};
    const out: NodeStyleOverride = {};
    if (typeof style.background === 'string' && style.background)
        out.background = style.background;
    if (typeof style.text === 'string' && style.text) out.text = style.text;
    return out;
}
