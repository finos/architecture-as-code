import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5';
import { useIsMobile } from '../../../../hooks/useMediaQuery.js';
import { THEME } from '../theme.js';
import { OVERLAY_STATUSES, viewKey, viewTitle } from '../../../overlay/overlayEngine.js';
import { OVERLAY_STYLES, STATUS_NAMES, viewMarkerColour } from './overlayStyle.js';
import { useDecoratorOverlays } from '../../../context/DecoratorOverlayContext.js';
import type { OverlayStatus, ViewOverlay } from '../../../contracts/contracts.js';

function statusCounts({ elements }: ViewOverlay): [OverlayStatus, number][] {
    const counts = new Map<OverlayStatus, number>();
    for (const { status } of elements.values()) counts.set(status, (counts.get(status) ?? 0) + 1);
    return OVERLAY_STATUSES.filter((s) => counts.has(s)).map((s) => [s, counts.get(s)!]);
}

/** The overlays of each extension, in first-seen order. A view without a source is its own group. */
function byExtension(overlays: readonly ViewOverlay[]): { id: string; name: string; overlays: ViewOverlay[] }[] {
    const groups = new Map<string, { id: string; name: string; overlays: ViewOverlay[] }>();
    for (const overlay of overlays) {
        const { source } = overlay.view;
        const id = source?.id ?? viewKey(overlay.view);
        const group = groups.get(id) ?? { id, name: source ? (source.builtIn ? `Built-in: ${source.name}` : source.name) : overlay.view.label, overlays: [] };
        group.overlays.push(overlay);
        groups.set(id, group);
    }
    return [...groups.values()];
}

function Marker({ colour }: { colour: string }) {
    return (
        <span
            aria-hidden="true"
            data-testid="overlay-marker"
            data-colour={colour}
            style={{ width: '10px', height: '10px', borderRadius: '2px', flexShrink: 0, background: colour }}
        />
    );
}

function GroupCheckbox({ name, checked, indeterminate, onChange }: { name: string; checked: boolean; indeterminate: boolean; onChange: () => void }) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
        <input
            ref={ref}
            type="checkbox"
            className="checkbox checkbox-xs"
            aria-label={`All views of ${name}`}
            checked={checked}
            onChange={onChange}
        />
    );
}

const LEGEND_STYLE: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxWidth: 'calc(100vw - 120px)',
    // Many extensions must not cover the diagram.
    maxHeight: '30vh',
    overflowY: 'auto',
    padding: '6px 10px',
    borderRadius: '8px',
    border: `1px solid ${THEME.colors.border}`,
    background: THEME.colors.card,
    boxShadow: THEME.shadows.sm,
    fontSize: '12px',
    color: THEME.colors.foreground,
};

/**
 * One row per decorator view on the diagram, with a toggle and how many elements show each status. An extension
 * with several views also gets a row that toggles all of them. Below 1024px (`useIsMobile`), the legend starts collapsed
 * to one button, so it does not cover the diagram.
 */
export function OverlayLegend() {
    const { overlays, hiddenViews, toggleView, setViewsShown, onOpenView } = useDecoratorOverlays();
    const isMobile = useIsMobile();
    const [expanded, setExpanded] = useState(false);
    const bodyId = useId();
    if (overlays.length === 0) return null;

    const viewRow = (overlay: ViewOverlay, indent: boolean) => {
        const { view } = overlay;
        const key = viewKey(view);
        const shown = !hiddenViews.has(key);
        return (
            <div
                key={key}
                data-testid="overlay-legend-row"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingLeft: indent ? '18px' : 0 }}
            >
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'pointer' }}>
                    <input type="checkbox" className="checkbox checkbox-xs" checked={shown} onChange={() => toggleView(key)} />
                    <Marker colour={viewMarkerColour(view)} />
                    {viewTitle(view)}
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
                        aria-label={`View all ${viewTitle(view)}`}
                        style={{ marginLeft: 'auto', color: THEME.colors.accentText }}
                        onClick={() => onOpenView(view)}
                    >
                        View all
                    </button>
                )}
            </div>
        );
    };

    const rows = byExtension(overlays).map((group) => {
        if (group.overlays.length === 1 || !setViewsShown) return group.overlays.map((overlay) => viewRow(overlay, false));
        const keys = group.overlays.map(({ view }) => viewKey(view));
        const shownCount = keys.filter((key) => !hiddenViews.has(key)).length;
        return (
            <div key={group.id} data-testid="overlay-legend-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, cursor: 'pointer' }}>
                    <GroupCheckbox
                        name={group.name}
                        checked={shownCount === keys.length}
                        indeterminate={shownCount > 0 && shownCount < keys.length}
                        onChange={() => setViewsShown(keys, shownCount < keys.length)}
                    />
                    <Marker colour={viewMarkerColour(group.overlays[0].view)} />
                    {group.name}
                </label>
                {group.overlays.map((overlay) => viewRow(overlay, true))}
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

    const shownCount = overlays.filter(({ view }) => !hiddenViews.has(viewKey(view))).length;
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
