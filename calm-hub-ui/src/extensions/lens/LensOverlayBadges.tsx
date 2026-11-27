import type { KeyboardEvent, MouseEvent } from 'react';
import type { ShownOverlay } from '../../visualizer/context/DecoratorOverlayContext.js';
import { statusText, viewKey, viewTitle } from '../../visualizer/overlay/overlayEngine.js';
import { OVERLAY_STYLES, viewMarkerColour } from '../../visualizer/components/reactflow/overlay/overlayStyle.js';
import { LENS_BADGE_HEIGHT, LENS_BADGE_TEXT, type PlacedBadge } from './overlays.js';

interface LensOverlayBadgesProps {
    badges: PlacedBadge[];
    background: string;
    /** The view whose details are open on this element. */
    openView?: string;
    onOpen: (shown: ShownOverlay, badge: SVGGElement) => void;
}

/**
 * The decorator badges of one lens element, drawn as on the CALM diagram: the marker of the view's extension, the
 * status glyph and the decorator's status. A click or Enter opens the badge details. The status text colours are CSS
 * variables, which an SVG presentation attribute ignores, so they go in `style`.
 */
export function LensOverlayBadges({ badges, background, openView, onOpen }: LensOverlayBadgesProps) {
    return (
        <g data-overlay-badges>
            {badges.map(({ shown: entry, x, y, width }) => {
                const { view, overlay } = entry;
                const style = OVERLAY_STYLES[overlay.status];
                const label = statusText(overlay.value);
                const open = (event: MouseEvent<SVGGElement> | KeyboardEvent<SVGGElement>) => {
                    // The element under the badge must not take it as a click, which can open another view.
                    event.stopPropagation();
                    onOpen(entry, event.currentTarget);
                };
                return (
                    <g key={viewKey(view)} transform={`translate(${x},${y})`} role="button" tabIndex={0} data-clickable
                        aria-label={`${viewTitle(view)}: ${label}`} aria-haspopup="dialog" aria-expanded={openView === viewKey(view)}
                        data-overlay-badge data-view={view.id} data-status={overlay.status} data-value={overlay.value}
                        onClick={open}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            open(event);
                        }}
                        style={{ cursor: 'pointer' }}
                        className="outline-none [&:focus-visible>.lens-badge-focus]:opacity-100">
                        <title>{viewTitle(view)}</title>
                        <rect width={width} height={LENS_BADGE_HEIGHT} rx={4} fill={background} stroke={style.accent} strokeWidth={1} />
                        <rect width={width} height={LENS_BADGE_HEIGHT} rx={4} fill={style.accent} fillOpacity={0.14} />
                        <rect x={6} y={(LENS_BADGE_HEIGHT - 7) / 2} width={7} height={7} rx={1.5} fill={viewMarkerColour(view)} data-marker={viewMarkerColour(view)} />
                        <text x={17} y={LENS_BADGE_HEIGHT / 2 + LENS_BADGE_TEXT / 3 + 0.5} fontSize={LENS_BADGE_TEXT} fontWeight={600} style={{ fill: style.text }}>
                            {style.glyph} {label}
                        </text>
                        <rect className="lens-badge-focus opacity-0" x={-3} y={-3} width={width + 6} height={LENS_BADGE_HEIGHT + 6} rx={6} fill="none" stroke="#2563eb" strokeWidth={2} />
                    </g>
                );
            })}
        </g>
    );
}
