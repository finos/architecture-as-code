import React from 'react';

/**
 * A marker id that is safe inside `url(#…)`. Characters outside `[A-Za-z0-9-]` are hex-escaped,
 * so two different edge ids never give the same marker id.
 */
export function arrowMarkerId(edgeId: string, end: 'start' | 'end'): string {
    const safe = edgeId.replace(/[^A-Za-z0-9-]/gu, (c) => `_${c.codePointAt(0)!.toString(16)}_`);
    return `calm-arrow-${end}-${safe}`;
}

/** Whether an edge end has a marker. React Flow passes an end with no marker as `url('#')`. */
export function hasMarker(marker: string | undefined): boolean {
    return !!marker && marker !== "url('#')";
}

/**
 * The closed arrowhead of React Flow's `MarkerType.ArrowClosed`, in a given colour. React Flow
 * shares one marker per colour value and puts the colour in the marker id, so it cannot follow
 * a CSS variable or the hover state of one edge.
 */
export function ArrowMarker({ id, color }: { id: string; color: string }) {
    return (
        <marker
            id={id}
            markerWidth="15"
            markerHeight="15"
            viewBox="-10 -10 20 20"
            markerUnits="strokeWidth"
            orient="auto-start-reverse"
            refX="0"
            refY="0"
        >
            <polyline
                points="-5,-4 0,0 -5,4 -5,-4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: color, fill: color, strokeWidth: 1 }}
            />
        </marker>
    );
}
