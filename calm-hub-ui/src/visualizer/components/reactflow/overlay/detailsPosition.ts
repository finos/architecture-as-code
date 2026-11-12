export const DETAILS_WIDTH = 288;
const MARGIN = 8;
const GAP = 6;
/** Below this much room under the badge, the details open above it if there is more room there. */
const MIN_ROOM_BELOW = 240;

export type DetailsPosition = { left: number; maxHeight: number } & ({ top: number } | { bottom: number });

/** Where the details go: below the badge, or above it near the bottom of the screen, always inside the viewport. */
export function detailsPosition(anchor: DOMRect, viewportWidth: number, viewportHeight: number): DetailsPosition {
    const left = Math.max(MARGIN, Math.min(anchor.left, viewportWidth - DETAILS_WIDTH - MARGIN));
    const roomBelow = viewportHeight - anchor.bottom - GAP - MARGIN;
    const roomAbove = anchor.top - GAP - MARGIN;
    if (roomBelow >= MIN_ROOM_BELOW || roomBelow >= roomAbove) {
        return { left, top: anchor.bottom + GAP, maxHeight: Math.max(roomBelow, 0) };
    }
    return { left, bottom: viewportHeight - anchor.top + GAP, maxHeight: roomAbove };
}
