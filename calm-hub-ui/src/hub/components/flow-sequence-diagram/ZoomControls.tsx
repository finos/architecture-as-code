import { IoAdd, IoRemove, IoScanOutline, IoLockClosedOutline, IoLockOpenOutline, IoMapOutline } from 'react-icons/io5';

interface ZoomControlsProps {
    onZoomIn: () => void;
    onZoomOut: () => void;
    onReset: () => void;
    isInteractive: boolean;
    onToggleInteractive: () => void;
    minimapHidden: boolean;
    onToggleMinimap: () => void;
}

/** Cells match ReactFlow's 26px controls, not daisyUI button sizes. */
const BUTTON_CLASS =
    'flex h-[26px] w-[26px] items-center justify-center text-base-content/70 ' +
    'transition-colors hover:bg-base-200 hover:text-base-content ' +
    'border-b border-base-300 last:border-b-0';

const ICON_SIZE = 14;

/** Matches ReactFlow's Controls offset on the architecture tab. */
const EDGE_OFFSET = 15;

/**
 * Mirrors ReactFlow's Controls on the architecture tab: a vertical stack at the
 * bottom left with zoom in, zoom out, fit, lock and minimap. Both flow tabs then
 * operate in the same way.
 */
export function ZoomControls({
    onZoomIn,
    onZoomOut,
    onReset,
    isInteractive,
    onToggleInteractive,
    minimapHidden,
    onToggleMinimap,
}: ZoomControlsProps) {
    const lockLabel = isInteractive ? 'Lock zoom and pan' : 'Unlock zoom and pan';
    const minimapLabel = minimapHidden ? 'Show minimap' : 'Hide minimap';

    return (
        <div
            className="absolute flex flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm"
            style={{ bottom: EDGE_OFFSET, left: EDGE_OFFSET, cursor: 'default' }}
            // The pane starts a drag-pan on pointerdown. Keep button presses separate.
            onPointerDown={(e) => e.stopPropagation()}
        >
            <button type="button" className={BUTTON_CLASS} title="Zoom in" aria-label="Zoom in" onClick={onZoomIn}>
                <IoAdd size={ICON_SIZE} />
            </button>
            <button type="button" className={BUTTON_CLASS} title="Zoom out" aria-label="Zoom out" onClick={onZoomOut}>
                <IoRemove size={ICON_SIZE} />
            </button>
            <button type="button" className={BUTTON_CLASS} title="Fit view" aria-label="Fit view" onClick={onReset}>
                <IoScanOutline size={ICON_SIZE} />
            </button>
            <button
                type="button"
                className={BUTTON_CLASS}
                title={lockLabel}
                aria-label={lockLabel}
                aria-pressed={!isInteractive}
                onClick={onToggleInteractive}
            >
                {isInteractive ? <IoLockOpenOutline size={ICON_SIZE} /> : <IoLockClosedOutline size={ICON_SIZE} />}
            </button>
            <button
                type="button"
                className={BUTTON_CLASS}
                title={minimapLabel}
                aria-label={minimapLabel}
                aria-pressed={!minimapHidden}
                onClick={onToggleMinimap}
            >
                <IoMapOutline size={ICON_SIZE} className={minimapHidden ? 'opacity-40' : undefined} />
            </button>
        </div>
    );
}
