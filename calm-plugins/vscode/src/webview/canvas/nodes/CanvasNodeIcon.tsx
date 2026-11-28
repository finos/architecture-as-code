import React from 'react';
import { initAllPacks, corePack, resolvePackNode, type NodeTypeEntry } from '../../../packs/index.js';

let packsInitialized = false;

const coreNodeEntries = new Map(corePack.nodes.map((node) => [node.typeId, node]));

function ensurePacksInitialized(): void {
    if (packsInitialized) return;
    initAllPacks();
    packsInitialized = true;
}

function resolveNodeEntry(calmType?: string): NodeTypeEntry | null {
    if (!calmType) return null;
    ensurePacksInitialized();
    return coreNodeEntries.get(calmType) ?? resolvePackNode(calmType);
}

function resizeIconSvg(svg: string, size: number): string {
    const resized = svg
        .replace(/width="[^"]+"/, `width="${size}"`)
        .replace(/height="[^"]+"/, `height="${size}"`);

    return resized.includes('aria-hidden=')
        ? resized
        : resized.replace('<svg ', '<svg aria-hidden="true" ');
}

export function getCanvasNodeIconMarkup(calmType?: string, size = 14): string | null {
    const entry = resolveNodeEntry(calmType);
    if (!entry) return null;
    return resizeIconSvg(entry.icon, size);
}

export interface CanvasNodeIconProps {
    calmType?: string;
    color?: string;
    size?: number;
    fallback?: React.ReactNode;
}

export function CanvasNodeIcon({
    calmType,
    color,
    size = 28,
    fallback = null,
}: CanvasNodeIconProps) {
    const markup = getCanvasNodeIconMarkup(calmType, size);
    if (!markup) return <>{fallback}</>;

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: `${size}px`,
                height: `${size}px`,
                lineHeight: 0,
                color: color ?? resolveNodeEntry(calmType)?.color.stroke,
                flexShrink: 0,
            }}
            dangerouslySetInnerHTML={{ __html: markup }}
        />
    );
}