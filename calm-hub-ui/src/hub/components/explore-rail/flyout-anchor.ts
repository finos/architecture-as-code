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
 */
export function anchorFlyout(trigger: DOMRect, viewportHeight: number): FlyoutAnchor {
    const roomBelow = viewportHeight - trigger.top - FLYOUT_GUTTER;
    const roomAbove = trigger.bottom - FLYOUT_GUTTER;
    const downward = roomBelow >= roomAbove;
    const maxHeight = Math.round(
        Math.min(viewportHeight * FLYOUT_MAX_HEIGHT_FRACTION, downward ? roomBelow : roomAbove)
    );

    return downward
        ? { left: trigger.right, top: trigger.top, maxHeight }
        : { left: trigger.right, bottom: viewportHeight - trigger.bottom, maxHeight };
}
