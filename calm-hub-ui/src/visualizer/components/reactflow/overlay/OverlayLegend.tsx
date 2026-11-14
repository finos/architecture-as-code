import { useId, useState, type CSSProperties } from 'react';
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5';
import { useIsMobile } from '../../../../hooks/useMediaQuery.js';
import { THEME } from '../theme.js';
import { OVERLAY_STATUSES } from '../../../overlay/overlayEngine.js';
import { OVERLAY_STYLES } from './overlayStyle.js';
import { useDecoratorOverlays } from '../../../context/DecoratorOverlayContext.js';
import type { OverlayStatus, ViewOverlay } from '../../../contracts/contracts.js';

const STATUS_NAMES: Record<OverlayStatus, string> = { ok: 'OK', warn: 'Warning', error: 'Error', info: 'Info' };

function statusCounts({ elements }: ViewOverlay): [OverlayStatus, number][] {
    const counts = new Map<OverlayStatus, number>();
    for (const { status } of elements.values()) counts.set(status, (counts.get(status) ?? 0) + 1);
    return OVERLAY_STATUSES.filter((s) => counts.has(s)).map((s) => [s, counts.get(s)!]);
}

const LEGEND_STYLE: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxWidth: 'calc(100vw - 120px)',
    padding: '6px 10px',
    borderRadius: '8px',
    border: `1px solid ${THEME.colors.border}`,
    background: THEME.colors.card,
    boxShadow: THEME.shadows.sm,
    fontSize: '12px',
    color: THEME.colors.foreground,
};

/**
 * One row per decorator view on the diagram, with a toggle and how many elements show each status. Below 1024px
 * (`useIsMobile`), the legend starts collapsed to one button, so it does not cover the diagram.
 */
export function OverlayLegend() {
    const { overlays, hiddenViews, toggleView, onOpenView } = useDecoratorOverlays();
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(false);
    const bodyId = useId();
    if (overlays.length === 0) return null;

    const rows = overlays.map((overlay) => {
        const { view } = overlay;
        const shown = !hiddenViews.has(view.id);
        return (
            <div key={view.id} data-testid="overlay-legend-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" className="checkbox checkbox-xs" checked={shown} onChange={() => toggleView(view.id)} />
                    {view.label}
                </label>
                {statusCounts(overlay).map(([status, count]) => (
                    <span
                        key={status}
                        data-status={status}
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', color: shown ? OVERLAY_STYLES[status].text : THEME.colors.muted }}
                    >
                        <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '9999px', background: OVERLAY_STYLES[status].accent }} />
                        {count} {STATUS_NAMES[status]}
                    </span>
                ))}
                {onOpenView && (
                    <button
                        type="button"
                        className="link"
                        aria-label={`View all ${view.label}`}
                        style={{ marginLeft: 'auto', color: THEME.colors.accentText }}
                        onClick={() => onOpenView(view)}
                    >
                        View all
                    </button>
                )}
            </div>
        );
    });

    if (!isMobile) {
        return (
            <div data-testid="overlay-legend" role="group" aria-label="Decorator overlays" style={LEGEND_STYLE}>
                {rows}
            </div>
        );
    }

    const shownCount = overlays.filter(({ view }) => !hiddenViews.has(view.id)).length;
    const Chevron = expanded ? IoChevronDownOutline : IoChevronUpOutline;
    return (
        <div
            data-testid="overlay-legend"
            role="group"
            aria-label="Decorator overlays"
            style={{ ...LEGEND_STYLE, maxWidth: 'calc(100vw - 24px)' }}
        >
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? bodyId : undefined}
                onClick={() => setExpanded((open) => !open)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, minHeight: '32px' }}
            >
                <Chevron aria-hidden="true" />
                Overlays ({shownCount} of {overlays.length} on)
            </button>
            {expanded && (
                <div id={bodyId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {rows}
                </div>
            )}
        </div>
    );
}
