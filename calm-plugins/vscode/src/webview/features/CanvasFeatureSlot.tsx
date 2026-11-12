import React, { type ReactNode } from 'react';
import type {
    CanvasFeatureDefinition,
    CanvasFeatureId,
    CanvasFeatureRuntime,
    CanvasFeatureSlot as CanvasFeatureSlotName,
} from './types';

interface CanvasFeatureSlotProps {
    slot: CanvasFeatureSlotName;
    definitions: readonly CanvasFeatureDefinition[];
    enabledFeatures: ReadonlySet<CanvasFeatureId>;
    runtime: CanvasFeatureRuntime;
    children?: ReactNode;
}

export function CanvasFeatureSlot({
    slot,
    definitions,
    enabledFeatures,
    runtime,
    children,
}: CanvasFeatureSlotProps) {
    const surfaces = definitions.flatMap((feature) => {
        const Surface = enabledFeatures.has(feature.id) ? feature.surfaces?.[slot] : undefined;
        return Surface ? [{ id: feature.id, Surface }] : [];
    });

    if (slot === 'canvas') {
        // Wrap in reverse order so feature declarations compose predictably around the core canvas.
        return surfaces.reduceRight<ReactNode>(
            (content, { id, Surface }) => <Surface key={id} runtime={runtime}>{content}</Surface>,
            children,
        );
    }

    // Non-canvas slots host independent panels, overlays, and dialogs beside the core UI.
    return (
        <>
            {surfaces.map(({ id, Surface }) => <Surface key={id} runtime={runtime} />)}
            {children}
        </>
    );
}