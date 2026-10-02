import { describe, expect, it } from 'vitest';
import { anchorFlyout, FLYOUT_GUTTER, FLYOUT_MAX_HEIGHT_FRACTION } from './flyout-anchor.js';

const VIEWPORT = 1000;
const TRIGGER_HEIGHT = 24;

/** A trigger 32px wide at the left edge of the rail, as the collapsed rail draws it. */
function trigger(top: number): DOMRect {
    return { top, bottom: top + TRIGGER_HEIGHT, left: 8, right: 40, height: TRIGGER_HEIGHT, width: 32, x: 8, y: top, toJSON: () => ({}) };
}

describe('anchorFlyout', () => {
    it('puts the panel just right of the trigger', () => {
        expect(anchorFlyout(trigger(100), VIEWPORT).left).toBe(40);
    });

    it('opens downward from a trigger in the upper half, level with it', () => {
        const anchor = anchorFlyout(trigger(100), VIEWPORT);
        expect(anchor.top).toBe(100);
        expect(anchor.bottom).toBeUndefined();
    });

    it('opens upward from a trigger in the lower half, ending level with it', () => {
        // Opening downward would leave 92px, so the rows below that would be off screen.
        const anchor = anchorFlyout(trigger(900), VIEWPORT);
        expect(anchor.bottom).toBe(VIEWPORT - 924);
        expect(anchor.top).toBeUndefined();
    });

    it('never grows past its share of the window', () => {
        expect(anchorFlyout(trigger(100), VIEWPORT).maxHeight).toBe(VIEWPORT * FLYOUT_MAX_HEIGHT_FRACTION);
    });

    it('limits the height to the room on the chosen side when that is the smaller of the two', () => {
        const anchor = anchorFlyout(trigger(450), VIEWPORT);
        expect(anchor.top).toBe(450);
        expect(anchor.maxHeight).toBe(542);
    });

    it('keeps a gutter between the panel and the edge of the window', () => {
        const anchor = anchorFlyout(trigger(450), VIEWPORT);
        expect(anchor.top! + anchor.maxHeight).toBe(VIEWPORT - FLYOUT_GUTTER);
    });

    it('rounds the height, because a fractional pixel reaches the DOM as 460.79999999999995', () => {
        expect(Number.isInteger(anchorFlyout(trigger(10), 768).maxHeight)).toBe(true);
    });

    it('keeps the panel inside the window when the trigger has scrolled above it', () => {
        // The rail scrolls under an open fly-out, so a re-measured trigger can sit outside
        // the window. The panel follows it, and without a floor it would follow it off screen.
        const anchor = anchorFlyout(trigger(-90), VIEWPORT);

        expect(anchor.top).toBe(FLYOUT_GUTTER);
        expect(anchor.top! + anchor.maxHeight).toBeLessThanOrEqual(VIEWPORT - FLYOUT_GUTTER);
    });

    it('keeps the panel inside the window when the trigger has scrolled below it', () => {
        const anchor = anchorFlyout(trigger(VIEWPORT + 40), VIEWPORT);

        expect(anchor.bottom).toBe(FLYOUT_GUTTER);
        expect(anchor.maxHeight).toBeGreaterThan(0);
    });

    it('never asks for a negative height', () => {
        for (const top of [-500, -24, 0, VIEWPORT - 24, VIEWPORT, VIEWPORT + 500]) {
            expect(anchorFlyout(trigger(top), VIEWPORT).maxHeight).toBeGreaterThanOrEqual(0);
        }
    });

    it('gives a positive height wherever the trigger sits, because it takes the roomier side', () => {
        for (let top = 0; top <= VIEWPORT - TRIGGER_HEIGHT; top += 25) {
            expect(anchorFlyout(trigger(top), VIEWPORT).maxHeight).toBeGreaterThan(0);
        }
    });
});
