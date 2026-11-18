import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { useStoreApi } from '@xyflow/react';
import { THEME } from '../theme.js';
import { statusText, viewTitle } from '../../../overlay/overlayEngine.js';
import { OVERLAY_STYLES, STATUS_NAMES, viewMarkerColour } from './overlayStyle.js';
import { useDecoratorOverlays, type ShownOverlay } from '../../../context/DecoratorOverlayContext.js';
import { DETAILS_WIDTH, detailsPosition } from './detailsPosition.js';

/** Entries past this many are counted, not listed. */
export const DETAILS_MAX_ENTRIES = 5;

function formatTime(value: string): string {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : new Date(time).toLocaleString();
}

interface OverlayBadgeDetailsProps {
    shown: ShownOverlay;
    anchor: DOMRect;
    /** The badge: a press on it toggles the details, so it does not count as outside. */
    trigger?: RefObject<Element | null>;
    /** `restoreFocus` is true when the details close from the keyboard or their own link, so focus goes back to the badge. */
    onClose: (restoreFocus: boolean) => void;
}

/**
 * What a badge means: its extension and view, and each decorator's status, scale, label and time. The details are placed
 * where the badge was when it was clicked, so they close when the diagram pans or zooms.
 */
export function OverlayBadgeDetails({ shown, anchor, trigger, onClose }: OverlayBadgeDetailsProps) {
    const { view, overlay } = shown;
    const { onOpenView } = useDecoratorOverlays();
    const ref = useRef<HTMLDivElement>(null);
    const store = useStoreApi();

    useEffect(() => {
        ref.current?.focus();
        const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose(true);
        const onPointer = (event: PointerEvent) => {
            const target = event.target as Node;
            if (!ref.current?.contains(target) && !trigger?.current?.contains(target)) onClose(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [onClose, trigger]);

    useEffect(() => {
        const [x, y, zoom] = store.getState().transform;
        return store.subscribe(({ transform }) => {
            if (transform[0] !== x || transform[1] !== y || transform[2] !== zoom) {
                onClose(!!ref.current?.contains(document.activeElement));
            }
        });
    }, [store, onClose]);

    // A portal still sends React events up the React tree, to the node: a click would select it, an arrow key move it.
    const stop = (event: SyntheticEvent) => event.stopPropagation();
    // The stop also keeps the key from the document listener, so Escape closes here.
    const onKeyDown = (event: ReactKeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Escape') onClose(true);
    };

    const source = view.source;
    const extraEntries = overlay.entries.length - DETAILS_MAX_ENTRIES;
    return createPortal(
        <div
            ref={ref}
            role="dialog"
            aria-label={viewTitle(view)}
            tabIndex={-1}
            data-testid="overlay-badge-details"
            className="nodrag nopan nowheel"
            onClick={stop}
            onDoubleClick={stop}
            onKeyDown={onKeyDown}
            style={{
                position: 'fixed',
                ...detailsPosition(anchor, window.innerWidth, window.innerHeight),
                zIndex: 60,
                width: `${DETAILS_WIDTH}px`,
                overflowY: 'auto',
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${THEME.colors.border}`,
                borderLeft: `4px solid ${viewMarkerColour(view)}`,
                background: THEME.colors.card,
                boxShadow: THEME.shadows.md,
                color: THEME.colors.foreground,
                fontSize: '12px',
            }}
        >
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', margin: 0 }}>
                <dt style={{ color: THEME.colors.muted }}>Extension</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                    {source ? (source.builtIn ? `Built-in (${source.name})` : source.name) : 'Unknown'}
                </dd>
                <dt style={{ color: THEME.colors.muted }}>View</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{view.label}</dd>
            </dl>
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {overlay.entries.slice(0, DETAILS_MAX_ENTRIES).map((entry, index) => (
                    <li key={`${entry.decorator.uniqueId}-${index}`} data-testid="overlay-badge-entry" style={{ borderTop: `1px solid ${THEME.colors.border}`, paddingTop: '6px' }}>
                        <div style={{ fontWeight: 600, color: OVERLAY_STYLES[entry.status].text }}>
                            {statusText(entry.value)} → {STATUS_NAMES[entry.status]}
                        </div>
                        {entry.label && <div>{entry.label}</div>}
                        {entry.time && <div style={{ color: THEME.colors.muted }}>{formatTime(entry.time)}</div>}
                    </li>
                ))}
            </ul>
            {extraEntries > 0 && <p style={{ margin: '6px 0 0', color: THEME.colors.muted }}>and {extraEntries} more</p>}
            {onOpenView && (
                <button
                    type="button"
                    className="link"
                    aria-label={`View all ${viewTitle(view)}`}
                    style={{ marginTop: '8px', color: THEME.colors.accentText }}
                    onClick={() => {
                        onOpenView(view);
                        onClose(true);
                    }}
                >
                    View all {view.label}
                </button>
            )}
        </div>,
        document.body,
    );
}
