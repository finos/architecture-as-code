/** Space kept between the fly-out and the edge of the window. */
export const FLYOUT_GUTTER = 8;

/** The share of the window height the fly-out may take at most. */
export const FLYOUT_MAX_HEIGHT_FRACTION = 0.6;

export interface FlyoutAnchor {
    left: number;
    /** Set when the panel opens downward, so its top edge is level with the trigger. */
    top?: number;
    /** Set when it opens upward instead, so its bottom edge is level with the trigger. */
    bottom?: number;
    maxHeight: number;
}

/**
 * Where to draw the collapsed rail's fly-out, in viewport coordinates.
 *
 * The rail scrolls its strip of initials, and a scroll container clips anything positioned
 * inside it, so the panel is fixed rather than absolute and needs coordinates of its own.
 * It opens from whichever side of the trigger has more room, so a root near the foot of the
 * window does not put its last rows off screen.
 *
 * The rail can scroll under an open panel, which leaves the trigger outside the window. The
 * edge the panel is pinned to is held a gutter inside the window for that case, so the panel
 * follows its trigger towards the edge but never past it.
 */
export function anchorFlyout(trigger: DOMRect, viewportHeight: number): FlyoutAnchor {
    const downward = viewportHeight - trigger.top >= trigger.bottom;
    const edge = clamp(downward ? trigger.top : viewportHeight - trigger.bottom, viewportHeight);
    const maxHeight = Math.round(Math.min(
        viewportHeight * FLYOUT_MAX_HEIGHT_FRACTION,
        viewportHeight - edge - FLYOUT_GUTTER
    ));

    return downward
        ? { left: trigger.right, top: edge, maxHeight }
        : { left: trigger.right, bottom: edge, maxHeight };
}

function clamp(offset: number, viewportHeight: number): number {
    return Math.min(Math.max(offset, FLYOUT_GUTTER), Math.max(FLYOUT_GUTTER, viewportHeight - FLYOUT_GUTTER));
}
