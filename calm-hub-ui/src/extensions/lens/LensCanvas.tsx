import { useId, useMemo, type KeyboardEvent, type PointerEvent } from 'react';
import type { LensNode } from '../../model/lens.js';
import type { Theme } from '../../theme/useTheme.js';
import { useSvgZoomPan } from '../../hub/components/flow-sequence-diagram/useSvgZoomPan.js';
import { ZoomControls } from '../../hub/components/flow-sequence-diagram/ZoomControls.js';
import { FONT_SIZE, LINE_HEIGHT, fitShape, midpoint } from './geometry.js';
import type { Layout, PlacedEdge } from './layout.js';
import { GroupShape, NodeShape, ShapeParts } from './LensShape.js';
import { CANVAS, DASH, findMarker, findShape, type ResolvedNotation } from './styles.js';

interface LensCanvasProps {
    layout: Layout;
    notation: ResolvedNotation;
    theme: Theme;
    selectedElement?: string;
    hiddenTags: ReadonlySet<string>;
    onActivateNode: (node: LensNode) => void;
    /** A click on an edge or a group with `calm` ids. */
    onSelect: (calm: string[]) => void;
}

const SELECTION = '#2563eb';
const DIMMED = 0.15;

/** The line through the points: straight segments, or a smooth curve through the bends for `curved`. */
function edgePath({ points, style }: Pick<PlacedEdge, 'points' | 'style'>): string {
    const [first, ...rest] = points;
    if (style.routing !== 'curved' || points.length < 3) return `M${first.x} ${first.y}${rest.map((p) => ` L${p.x} ${p.y}`).join('')}`;
    let d = `M${first.x} ${first.y}`;
    for (let i = 1; i < points.length - 1; i++) {
        const next = points[i + 1];
        const end = i === points.length - 2 ? next : { x: (points[i].x + next.x) / 2, y: (points[i].y + next.y) / 2 };
        d += ` Q${points[i].x} ${points[i].y} ${end.x} ${end.y}`;
    }
    return d;
}

/** A point near one end, set off from the line, for a multiplicity or a role. */
function endLabelPoint(points: { x: number; y: number }[], atEnd: boolean) {
    const [a, b] = atEnd ? [points[points.length - 1], points[points.length - 2]] : [points[0], points[1]];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
    return { x: a.x + ux * 16 - uy * 10, y: a.y + uy * 16 + ux * 10 };
}

const activate = (handler: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handler();
    }
};

export function LensCanvas({ layout, notation, theme, selectedElement, hiddenTags, onActivateNode, onSelect }: LensCanvasProps) {
    const { containerRef, contentRef, transform, isPanning, isInteractive, panHandlers, toggleInteractive, zoomIn, zoomOut, reset } = useSvgZoomPan();
    const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
    const canvas = CANVAS[theme];
    // One SVG marker for each marker and colour in use.
    const markers = useMemo(() => {
        const ids = new Map<string, { id: string; name: string; color: string }>();
        for (const { style } of layout.edges) {
            for (const name of [style.start, style.end]) {
                const key = `${name}|${style.color}`;
                if (name && !ids.has(key)) ids.set(key, { id: `${uid}-m${ids.size}`, name, color: style.color });
            }
        }
        return ids;
    }, [layout, uid]);
    const markerUrl = (name: string | undefined, color: string) => (name ? `url(#${markers.get(`${name}|${color}`)?.id})` : undefined);
    const hidden = (tags: string[] | undefined) => !!tags?.some((tag) => hiddenTags.has(tag));
    const selected = (calm: string[] | undefined) => !!selectedElement && !!calm?.includes(selectedElement);

    // A drag-pan captures the pointer, and the click then goes to the pane. So a press on an element that takes a
    // click does not start a pan.
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!(event.target as Element).closest('[data-clickable]')) panHandlers.onPointerDown(event);
    };

    return (
        <div
            ref={containerRef}
            {...panHandlers}
            onPointerDown={onPointerDown}
            className="relative h-full w-full touch-none overflow-hidden"
            style={{ cursor: isPanning ? 'grabbing' : 'grab', background: canvas.background }}
        >
            <div
                className="flex h-full w-full items-center justify-center p-4"
                style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0' }}
            >
                <svg
                    ref={contentRef}
                    viewBox={`0 0 ${layout.width} ${layout.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="h-full w-full"
                    // A small diagram fits the pane, but grows to at most 1.25 times its size.
                    style={{ maxWidth: layout.width * 1.25, maxHeight: layout.height * 1.25, fontFamily: 'inherit' }}
                    role="img"
                    aria-roledescription="diagram"
                    data-testid="lens-canvas"
                >
                    <defs>
                        {[...markers.values()].map(({ id, name, color }) => {
                            const marker = findMarker(notation, name)!;
                            const [minX, minY, width, height] = marker.viewBox;
                            const fit = fitShape({ viewBox: marker.viewBox, parts: marker.parts }, undefined, undefined, width, height);
                            return (
                                <marker key={id} id={id} viewBox={`0 0 ${width} ${height}`} refX={width} refY={height / 2}
                                    markerWidth={width} markerHeight={height} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                                    <ShapeParts
                                        shape={{ viewBox: [minX, minY, width, height], parts: marker.parts }}
                                        fit={fit}
                                        style={{ background: canvas.background, color: color, stroke: color, accent: color, strokeWidth: 1.5, border: 'solid' }}
                                    />
                                </marker>
                            );
                        })}
                    </defs>
                    {layout.groups.map(({ group, style, x, y, width, height }) => {
                        const shape = style.shape ? findShape(notation, style.shape) : undefined;
                        const fit = shape ? fitShape(shape, undefined, undefined, width, height) : fitShape({ viewBox: [0, 0, width, height], parts: [] }, undefined, undefined, width, height);
                        return (
                            <g key={`g-${group.id}`} transform={`translate(${x},${y})`} opacity={hidden(group.tags) ? DIMMED : style.opacity}
                                data-group={group.id} data-clickable={group.calm?.length ? true : undefined} onClick={group.calm?.length ? () => onSelect(group.calm!) : undefined}>
                                <GroupShape label={group.label} shape={shape} fit={fit} style={style} />
                                {selected(group.calm) && <rect width={width} height={height} rx={6} fill="none" stroke={SELECTION} strokeWidth={2} />}
                            </g>
                        );
                    })}
                    {layout.edges.map((placed) => {
                        const { edge, style, points, label } = placed;
                        const d = edgePath(placed);
                        const mid = placed.labelAt ?? midpoint(points);
                        const size = FONT_SIZE.small;
                        const isSelected = selected(edge.calm);
                        return (
                            <g key={`e-${edge.id}`} data-edge={edge.id} data-clickable={edge.calm?.length ? true : undefined} opacity={hidden(edge.tags) ? DIMMED : style.opacity}
                                onClick={edge.calm?.length ? () => onSelect(edge.calm!) : undefined} style={edge.calm?.length ? { cursor: 'pointer' } : undefined}>
                                {edge.tooltip && <title>{edge.tooltip}</title>}
                                <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
                                <path d={d} fill="none" stroke={isSelected ? SELECTION : style.color} strokeWidth={isSelected ? style.thickness + 1.5 : style.thickness}
                                    strokeDasharray={DASH[style.style]} markerStart={markerUrl(style.start, style.color)} markerEnd={markerUrl(style.end, style.color)} />
                                {label.map((line, index) => (
                                    <text key={index} x={mid.x} y={mid.y + (index - (label.length - 1) / 2) * size * LINE_HEIGHT + size / 3} textAnchor="middle"
                                        fontSize={size} fill={canvas.text} stroke={canvas.background} strokeWidth={4} paintOrder="stroke">
                                        {line}
                                    </text>
                                ))}
                                {[edge.startLabel, edge.endLabel].map((text, index) => {
                                    if (!text || points.length < 2) return null;
                                    const at = endLabelPoint(points, index === 1);
                                    return (
                                        <text key={index} x={at.x} y={at.y} textAnchor="middle" fontSize={size} fill={canvas.text} stroke={canvas.background} strokeWidth={3} paintOrder="stroke">
                                            {text}
                                        </text>
                                    );
                                })}
                            </g>
                        );
                    })}
                    {layout.nodes.map(({ node, style, shape, fit, x, y }) => {
                        const interactive = !!node.link || !!node.calm?.length;
                        return (
                            <g key={`n-${node.id}`} transform={`translate(${x},${y})`} data-node={node.id}
                                opacity={hidden(node.tags) ? DIMMED : style.opacity}
                                data-clickable={interactive || undefined} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : undefined} aria-label={interactive ? node.label : undefined}
                                onClick={interactive ? () => onActivateNode(node) : undefined}
                                onKeyDown={interactive ? activate(() => onActivateNode(node)) : undefined}
                                style={interactive ? { cursor: 'pointer' } : undefined}
                                className="outline-none [&:focus-visible>.lens-focus]:opacity-100">
                                <title>{[node.tooltip, node.link?.params ? 'Click to open' : undefined].filter(Boolean).join('\n') || node.label}</title>
                                <NodeShape node={node} shape={shape} fit={fit} style={style} />
                                {selected(node.calm) && <rect x={-4} y={-4} width={fit.width + 8} height={fit.height + 8} rx={8} fill="none" stroke={SELECTION} strokeWidth={3} data-selected />}
                                <rect className="lens-focus opacity-0" x={-6} y={-6} width={fit.width + 12} height={fit.height + 12} rx={9} fill="none" stroke={SELECTION} strokeWidth={2} strokeDasharray="4 3" />
                            </g>
                        );
                    })}
                </svg>
            </div>
            <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} isInteractive={isInteractive} onToggleInteractive={toggleInteractive} />
        </div>
    );
}
