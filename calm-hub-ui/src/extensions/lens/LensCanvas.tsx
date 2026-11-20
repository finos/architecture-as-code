import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { LensNode } from '../../model/lens.js';
import { useDecoratorOverlays, type ShownOverlay } from '../../visualizer/context/DecoratorOverlayContext.js';
import { viewKey, worstStatus } from '../../visualizer/overlay/overlayEngine.js';
import { OverlayBadgeDetails } from '../../visualizer/components/reactflow/overlay/OverlayBadgeDetails.js';
import { overlayOutline } from '../../visualizer/components/reactflow/overlay/overlayStyle.js';
import type { Theme } from '../../theme/useTheme.js';
import { useSvgZoomPan } from '../../hub/components/flow-sequence-diagram/useSvgZoomPan.js';
import { ZoomControls } from '../../hub/components/flow-sequence-diagram/ZoomControls.js';
import { FONT_SIZE, LINE_HEIGHT, fitShape, midpoint } from './geometry.js';
import type { Layout, PlacedEdge } from './layout.js';
import { GroupShape, NodeShape, ShapeParts } from './LensShape.js';
import { LensOverlayBadges } from './LensOverlayBadges.js';
import { LENS_BADGE_HEIGHT, lensOverlayKey, placeBadges } from './overlays.js';
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

/** The badge whose details are open: its element and view. The details read the overlay of this render. */
interface OpenDetails {
    element: string;
    view: string;
    anchor: DOMRect;
    trigger: { current: SVGGElement };
}

/** Badges of an edge wrap at this width. Those of a node or a group wrap at its width. */
const EDGE_BADGES_WIDTH = 220;

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

    // The decorator overlays, keyed by `lensOverlayKey`, without the views that the legend turned off.
    const { overlays, hiddenViews } = useDecoratorOverlays();
    const shownOn = (key: string): ShownOverlay[] => overlays.flatMap(({ view, elements }) => {
        const overlay = elements.get(key);
        return overlay && !hiddenViews.has(viewKey(view)) ? [{ view, overlay }] : [];
    });
    // An edge shows only the views that need attention, as on the CALM diagram.
    const flagged = (shown: ShownOverlay[]) => shown.filter(({ overlay }) => overlayOutline(overlay.status));
    const outline = (shown: ShownOverlay[]) => overlayOutline(worstStatus(shown.map(({ overlay }) => overlay.status)));
    const [details, setDetails] = useState<OpenDetails>();
    const openDetails = (element: string) => (shown: ShownOverlay, badge: SVGGElement) =>
        setDetails((current) => current?.element === element && current.view === viewKey(shown.view)
            ? undefined
            : { element, view: viewKey(shown.view), anchor: badge.getBoundingClientRect(), trigger: { current: badge } });
    const closeDetails = useCallback((restoreFocus: boolean) => {
        if (restoreFocus) details?.trigger.current.focus({ preventScroll: true });
        setDetails(undefined);
    }, [details]);
    // The badges are a layer above every element, so a neighbour does not cover them, and they are not inside the
    // button of a node. A node's badges are on its bottom edge, as the lens badges are on the top edge.
    // Badges wrap to the width of their element, and the view box takes in every badge, so each one shows and takes a click.
    const badges = [
        ...layout.groups.map(({ group, x, y, width }) => {
            const key = lensOverlayKey('group', group.id);
            return { key, shown: shownOn(key), placed: placeBadges(shownOn(key), x + width - 8, y + 6, 'end', width - 16), tags: group.tags };
        }),
        ...layout.edges.map(({ edge, points, label, labelAt }) => {
            const mid = labelAt ?? midpoint(points);
            const key = lensOverlayKey('edge', edge.id);
            const shown = flagged(shownOn(key));
            return { key, shown, placed: placeBadges(shown, mid.x, mid.y + (label.length / 2) * FONT_SIZE.small * LINE_HEIGHT + 4, 'middle', EDGE_BADGES_WIDTH), tags: edge.tags };
        }),
        ...layout.nodes.map(({ node, fit, x, y }) => {
            const key = lensOverlayKey('node', node.id);
            return { key, shown: shownOn(key), placed: placeBadges(shownOn(key), x + 8, y + fit.height - LENS_BADGE_HEIGHT / 2, 'start', fit.width - 16), tags: node.tags };
        }),
    ].filter(({ shown }) => shown.length > 0);
    const placedBadges = badges.flatMap(({ placed }) => placed);
    const box = {
        left: Math.min(0, ...placedBadges.map(({ x }) => x - 4)),
        top: Math.min(0, ...placedBadges.map(({ y }) => y - 4)),
        right: Math.max(layout.width, ...placedBadges.map(({ x, width }) => x + width + 4)),
        bottom: Math.max(layout.height, ...placedBadges.map(({ y }) => y + LENS_BADGE_HEIGHT + 4)),
    };
    const boxWidth = box.right - box.left;
    const boxHeight = box.bottom - box.top;
    // The details show the overlay of this render, and close when the badge goes: its decorator went, its view was
    // turned off, or its edge became ok.
    const openShown = details && badges.find(({ key }) => key === details.element)?.shown.find(({ view }) => viewKey(view) === details.view);
    if (details && !openShown) setDetails(undefined);
    // The details stay where the badge was, so they close when the diagram pans or zooms.
    const moveListeners = useRef(new Set<() => void>());
    useEffect(() => {
        for (const listener of [...moveListeners.current]) listener();
    }, [transform]);
    const subscribeToMoves = useCallback((onMove: () => void) => {
        moveListeners.current.add(onMove);
        return () => {
            moveListeners.current.delete(onMove);
        };
    }, []);
    const openView = (element: string) => (details?.element === element ? details.view : undefined);

    // A drag-pan captures the pointer, and the click then goes to the pane. So a press on an element that takes a
    // click does not start a pan. The badge details are in a portal, but React still sends their events here.
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        const target = event.target as Element;
        if (!containerRef.current?.contains(target)) return;
        if (!target.closest('[data-clickable]')) panHandlers.onPointerDown(event);
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
                    viewBox={`${box.left} ${box.top} ${boxWidth} ${boxHeight}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="h-full w-full"
                    // A small diagram fits the pane, but grows to at most 1.25 times its size.
                    style={{ maxWidth: boxWidth * 1.25, maxHeight: boxHeight * 1.25, fontFamily: 'inherit' }}
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
                        const decorated = outline(shownOn(lensOverlayKey('group', group.id)));
                        const shape = style.shape ? findShape(notation, style.shape) : undefined;
                        const fit = shape ? fitShape(shape, undefined, undefined, width, height) : fitShape({ viewBox: [0, 0, width, height], parts: [] }, undefined, undefined, width, height);
                        return (
                            <g key={`g-${group.id}`} transform={`translate(${x},${y})`} opacity={hidden(group.tags) ? DIMMED : style.opacity}
                                data-group={group.id} data-clickable={group.calm?.length ? true : undefined} onClick={group.calm?.length ? () => onSelect(group.calm!) : undefined}>
                                <GroupShape label={group.label} shape={shape} fit={fit} style={style} />
                                {decorated && <rect width={width} height={height} rx={6} fill="none" stroke={decorated} strokeWidth={2.5} data-overlay-outline={decorated} />}
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
                        const decorated = outline(shownOn(lensOverlayKey('node', node.id)));
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
                                {decorated && <rect x={-2} y={-2} width={fit.width + 4} height={fit.height + 4} rx={7} fill="none" stroke={decorated} strokeWidth={2.5} data-overlay-outline={decorated} />}
                                {selected(node.calm) && <rect x={-4} y={-4} width={fit.width + 8} height={fit.height + 8} rx={8} fill="none" stroke={SELECTION} strokeWidth={3} data-selected />}
                                <rect className="lens-focus opacity-0" x={-6} y={-6} width={fit.width + 12} height={fit.height + 12} rx={9} fill="none" stroke={SELECTION} strokeWidth={2} strokeDasharray="4 3" />
                            </g>
                        );
                    })}
                    {badges.map(({ key, placed, tags }) => (
                        <g key={`b-${key}`} data-overlay-for={key} opacity={hidden(tags) ? DIMMED : undefined}>
                            <LensOverlayBadges badges={placed} background={canvas.background} openView={openView(key)} onOpen={openDetails(key)} />
                        </g>
                    ))}
                </svg>
            </div>
            <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onReset={reset} isInteractive={isInteractive} onToggleInteractive={toggleInteractive} />
            {details && openShown && (
                <OverlayBadgeDetails shown={openShown} anchor={details.anchor} trigger={details.trigger} onClose={closeDetails} subscribeToMoves={subscribeToMoves} />
            )}
        </div>
    );
}
