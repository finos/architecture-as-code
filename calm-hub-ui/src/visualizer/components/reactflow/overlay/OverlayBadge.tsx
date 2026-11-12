import { useCallback, useRef, useState, type MouseEvent } from 'react';
import { THEME } from '../theme.js';
import { scalePx } from '../../../../theme/useDiagramTextScale.js';
import { statusText, viewTitle } from '../../../overlay/overlayEngine.js';
import { OVERLAY_STYLES, viewMarkerColour } from './overlayStyle.js';
import { OverlayBadgeDetails } from './OverlayBadgeDetails.js';
import type { ShownOverlay } from '../../../context/DecoratorOverlayContext.js';

function BadgeMarker({ colour, size }: { colour: string; size: string }) {
    return (
        <span
            aria-hidden="true"
            data-testid="overlay-marker"
            data-colour={colour}
            style={{ width: size, height: size, borderRadius: '2px', flexShrink: 0, background: colour }}
        />
    );
}

/** The badge a decorator view draws beside a node's label. A click shows what it means. */
export function OverlayBadge({ shown, presenting, scale }: { shown: ShownOverlay; presenting: boolean; scale: number }) {
    const { view, overlay } = shown;
    const style = OVERLAY_STYLES[overlay.status];
    const Icon = style.icon;
    const label = statusText(overlay.value);
    const size = scalePx(presenting ? 18 : 12, scale);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const button = useRef<HTMLButtonElement>(null);
    const close = useCallback((restoreFocus: boolean) => {
        setAnchor(null);
        // The badge can be out of view after a pan; a scroll to it would move the diagram's pane.
        if (restoreFocus) button.current?.focus({ preventScroll: true });
    }, []);
    const toggle = (event: MouseEvent<HTMLButtonElement>) => {
        // The node must not take the click as a selection.
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        setAnchor((current) => (current ? null : rect));
    };
    return (
        <>
            <button
                ref={button}
                type="button"
                className="nodrag nopan"
                data-testid="overlay-badge"
                data-view={view.id}
                data-status={overlay.status}
                data-value={overlay.value}
                aria-label={`${viewTitle(view)}: ${label}`}
                aria-haspopup="dialog"
                aria-expanded={!!anchor}
                onClick={toggle}
                style={{
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: presenting ? '3px 8px' : '2px 6px',
                    borderRadius: '4px',
                    fontSize: size,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    background: `${style.accent}20`,
                    color: style.text,
                }}
            >
                <BadgeMarker colour={viewMarkerColour(view)} size={scalePx(presenting ? 10 : 7, scale)} />
                <Icon aria-hidden="true" style={{ width: size, height: size }} />
                <span>{label}</span>
            </button>
            {anchor && <OverlayBadgeDetails shown={shown} anchor={anchor} trigger={button} onClose={close} />}
        </>
    );
}

/** An edge shows only the views that need attention: the edge itself is too thin to carry an ok badge. */
export function OverlayEdgeBadge({ shown, presenting, scale }: { shown: ShownOverlay; presenting: boolean; scale: number }) {
    const { view, overlay } = shown;
    const style = OVERLAY_STYLES[overlay.status];
    const label = statusText(overlay.value);
    return (
        <span
            data-testid="edge-overlay-badge"
            data-view={view.id}
            data-status={overlay.status}
            title={viewTitle(view)}
            style={{
                fontSize: scalePx(presenting ? 18 : 11, scale),
                fontWeight: 600,
                padding: presenting ? '3px 8px' : '2px 4px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                background: THEME.colors.card,
                border: `1px solid ${style.accent}`,
                color: style.text,
            }}
        >
            <span
                aria-hidden="true"
                style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '1px', marginRight: '3px', background: viewMarkerColour(view) }}
            />
            <span aria-hidden="true">{style.glyph}</span> {label}
        </span>
    );
}
