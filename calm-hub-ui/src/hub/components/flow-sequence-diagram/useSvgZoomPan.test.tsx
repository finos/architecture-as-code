import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useSvgZoomPan, MIN_SCALE, MAX_SCALE } from './useSvgZoomPan.js';

/**
 * jsdom gives every element a zero-sized rect, so the hook's anchor maths would
 * run against a 0x0 pane. Pin a known rect and expose the live transform.
 */
const PANE = { left: 100, top: 50, width: 400, height: 300 };

function Harness() {
    const zoom = useSvgZoomPan();
    return (
        <div
            data-testid="pane"
            ref={zoom.containerRef}
            {...zoom.panHandlers}
            data-scale={zoom.transform.scale}
            data-x={zoom.transform.x}
            data-y={zoom.transform.y}
            data-panning={String(zoom.isPanning)}
            data-interactive={String(zoom.isInteractive)}
        >
            <button onClick={zoom.zoomIn}>in</button>
            <button onClick={zoom.zoomOut}>out</button>
            <button onClick={zoom.reset}>reset</button>
            <button onClick={zoom.toggleInteractive}>lock</button>
        </div>
    );
}

const pane = () => screen.getByTestId('pane');
const scale = () => Number(pane().dataset.scale);
const pos = () => ({ x: Number(pane().dataset.x), y: Number(pane().dataset.y) });

/**
 * jsdom has no PointerEvent, so testing-library falls back to a plain Event with
 * no `button`. The hook reads that property to reject non-primary drags. Back it with
 * MouseEvent so `button` is carried through.
 */
class TestPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly isPrimary: boolean;
    constructor(type: string, props: PointerEventInit = {}) {
        super(type, props);
        this.pointerId = props.pointerId ?? 1;
        this.isPrimary = props.isPrimary ?? true;
    }
}

/** Dispatches a real wheel event, since the hook listens natively rather than via onWheel. */
function wheel(deltaY: number, clientX = PANE.left + 200, clientY = PANE.top + 150) {
    const event = new WheelEvent('wheel', {
        deltaY,
        clientX,
        clientY,
        bubbles: true,
        cancelable: true,
    });
    act(() => {
        pane().dispatchEvent(event);
    });
    return event;
}

describe('useSvgZoomPan', () => {
    beforeEach(() => {
        vi.stubGlobal('PointerEvent', TestPointerEvent);
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
            ...PANE,
            right: PANE.left + PANE.width,
            bottom: PANE.top + PANE.height,
            x: PANE.left,
            y: PANE.top,
            toJSON: () => '',
        } as DOMRect);
        // jsdom does not implement the Pointer Capture API.
        Element.prototype.setPointerCapture = vi.fn();
        Element.prototype.releasePointerCapture = vi.fn();
        Element.prototype.hasPointerCapture = vi.fn(() => true);
    });

    it('zooms in on a negative wheel delta and out on a positive one', () => {
        render(<Harness />);
        expect(scale()).toBe(1);

        wheel(-200);
        expect(scale()).toBeGreaterThan(1);

        const zoomedIn = scale();
        wheel(200);
        expect(scale()).toBeLessThan(zoomedIn);
    });

    it('preventDefaults the wheel so the page does not scroll while zooming', () => {
        render(<Harness />);
        expect(wheel(-100).defaultPrevented).toBe(true);
    });

    it('keeps the point under the cursor fixed while zooming', () => {
        render(<Harness />);
        // Anchored at the pane origin: with transformOrigin 0 0 and no prior
        // offset that point is already fixed, so the offset must stay at zero.
        wheel(-200, PANE.left, PANE.top);
        expect(pos()).toEqual({ x: 0, y: 0 });

        // Anchoring anywhere else must shift the content to hold that point still.
        wheel(-200, PANE.left + 200, PANE.top + 150);
        expect(pos().x).toBeLessThan(0);
        expect(pos().y).toBeLessThan(0);
    });

    it('clamps zoom to the supported range', () => {
        render(<Harness />);
        for (let i = 0; i < 40; i++) wheel(-500);
        expect(scale()).toBeCloseTo(MAX_SCALE, 5);

        for (let i = 0; i < 80; i++) wheel(500);
        expect(scale()).toBeCloseTo(MIN_SCALE, 5);
    });

    it('pans by the pointer delta on primary-button drag', () => {
        render(<Harness />);
        fireEvent.pointerDown(pane(), { button: 0, pointerId: 1, clientX: 200, clientY: 200 });
        expect(pane().dataset.panning).toBe('true');

        fireEvent.pointerMove(pane(), { pointerId: 1, clientX: 260, clientY: 175 });
        expect(pos()).toEqual({ x: 60, y: -25 });

        fireEvent.pointerUp(pane(), { pointerId: 1 });
        expect(pane().dataset.panning).toBe('false');

        // Movement after release must not keep panning.
        fireEvent.pointerMove(pane(), { pointerId: 1, clientX: 400, clientY: 400 });
        expect(pos()).toEqual({ x: 60, y: -25 });
    });

    it('ignores non-primary buttons so context menus still work', () => {
        render(<Harness />);
        fireEvent.pointerDown(pane(), { button: 2, pointerId: 1, clientX: 200, clientY: 200 });
        fireEvent.pointerMove(pane(), { pointerId: 1, clientX: 300, clientY: 300 });
        expect(pos()).toEqual({ x: 0, y: 0 });
    });

    it('resets scale and offset together', () => {
        render(<Harness />);
        wheel(-200);
        fireEvent.pointerDown(pane(), { button: 0, pointerId: 1, clientX: 200, clientY: 200 });
        fireEvent.pointerMove(pane(), { pointerId: 1, clientX: 300, clientY: 300 });
        fireEvent.pointerUp(pane(), { pointerId: 1 });
        expect(scale()).not.toBe(1);

        fireEvent.click(screen.getByText('reset'));
        expect(scale()).toBe(1);
        expect(pos()).toEqual({ x: 0, y: 0 });
    });

    it('zooms about the pane centre for the buttons', () => {
        render(<Harness />);
        fireEvent.click(screen.getByText('in'));
        expect(scale()).toBeGreaterThan(1);

        fireEvent.click(screen.getByText('out'));
        expect(scale()).toBeCloseTo(1, 5);
    });

    describe('interactivity lock', () => {
        it('stops wheel zoom and drag pan while locked', () => {
            render(<Harness />);
            fireEvent.click(screen.getByText('lock'));
            expect(pane().dataset.interactive).toBe('false');

            // The listener is detached, so the page keeps its default scroll.
            expect(wheel(-200).defaultPrevented).toBe(false);
            expect(scale()).toBe(1);

            fireEvent.pointerDown(pane(), { button: 0, pointerId: 1, clientX: 200, clientY: 200 });
            fireEvent.pointerMove(pane(), { pointerId: 1, clientX: 300, clientY: 300 });
            expect(pos()).toEqual({ x: 0, y: 0 });
        });

        it('restores zoom and pan when unlocked again', () => {
            render(<Harness />);
            fireEvent.click(screen.getByText('lock'));
            fireEvent.click(screen.getByText('lock'));
            expect(pane().dataset.interactive).toBe('true');

            wheel(-200);
            expect(scale()).toBeGreaterThan(1);
        });

        it('leaves the buttons working while locked, as ReactFlow does', () => {
            render(<Harness />);
            fireEvent.click(screen.getByText('lock'));
            fireEvent.click(screen.getByText('in'));
            expect(scale()).toBeGreaterThan(1);
        });
    });

    describe('panIntoView', () => {
        /**
         * Renders the hook over targets whose rects the test controls. The pane is
         * the container, so children are found by the selector as in production.
         * `content` is deliberately far larger than the pane, and offset, so the
         * overflow gate opens and the clamp leaves room to move both ways.
         */
        function ViewHarness({
            boxes,
            content = '-800,-1000,2000,3000',
        }: {
            boxes: Array<[number, number, number?, number?]>;
            content?: string;
        }) {
            const zoom = useSvgZoomPan();
            return (
                <div
                    data-testid="pane"
                    ref={zoom.containerRef}
                    data-x={zoom.transform.x}
                    data-y={zoom.transform.y}
                >
                    <svg ref={zoom.contentRef} data-box={content} />
                    {boxes.map(([left, top, w = 100, h = 20], i) => (
                        <span key={i} data-active-step="" data-box={`${left},${top},${w},${h}`} />
                    ))}
                    <button onClick={() => zoom.panIntoView('[data-active-step]')}>follow</button>
                </div>
            );
        }

        /**
         * getBoundingClientRect is mocked globally to the pane rect, so give the
         * targets their own rects from the data-box attribute.
         */
        beforeEach(() => {
            // Pane spans x 100-500, y 50-350 (see PANE); keep that for the container.
            const paneRect = {
                ...PANE,
                right: PANE.left + PANE.width,
                bottom: PANE.top + PANE.height,
                x: PANE.left,
                y: PANE.top,
                toJSON: () => '',
            } as DOMRect;
            vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
                this: Element
            ) {
                const spec = this.getAttribute?.('data-box');
                if (!spec) return paneRect;
                const [left, top, w, h] = spec.split(',').map(Number);
                return {
                    left,
                    top,
                    width: w,
                    height: h,
                    right: left + w,
                    bottom: top + h,
                    x: left,
                    y: top,
                    toJSON: () => '',
                } as DOMRect;
            });
        });

        it('centres a step that has scrolled out of the pane', () => {
            render(<ViewHarness boxes={[[200, 900]]} />);
            fireEvent.click(screen.getByText('follow'));

            // Target centre (250, 910) must move to the pane centre (300, 200).
            expect(pos()).toEqual({ x: 50, y: -710 });
        });

        it('centres the union of a parallel step, not just one message', () => {
            // Two concurrent messages far apart vertically; centring either alone
            // would leave the other off-screen.
            render(
                <ViewHarness
                    boxes={[
                        [200, 900, 100, 20],
                        [200, 1100, 100, 20],
                    ]}
                />
            );
            fireEvent.click(screen.getByText('follow'));

            // Union spans y 900-1120, centre 1010 -> pane centre 200.
            expect(pos()).toEqual({ x: 50, y: -810 });
        });

        it('leaves the view alone when the step is already visible', () => {
            render(<ViewHarness boxes={[[200, 150]]} />);
            fireEvent.click(screen.getByText('follow'));
            expect(pos()).toEqual({ x: 0, y: 0 });
        });

        it('ignores a step with no matching elements', () => {
            render(<ViewHarness boxes={[]} />);
            fireEvent.click(screen.getByText('follow'));
            expect(pos()).toEqual({ x: 0, y: 0 });
        });

        it('does not follow while the whole diagram already fits the pane', () => {
            // Regression: selecting a step used to re-centre even with nothing
            // off-screen, which yanked the diagram sideways on every click.
            render(<ViewHarness boxes={[[200, 900]]} content="100,50,300,200" />);
            fireEvent.click(screen.getByText('follow'));
            expect(pos()).toEqual({ x: 0, y: 0 });
        });

        it('clamps the follow so the diagram cannot leave the pane', () => {
            // Content exactly fills the pane horizontally, so no x movement is
            // allowed however far off-centre the target is.
            render(<ViewHarness boxes={[[2000, 900]]} content="100,50,400,3000" />);
            fireEvent.click(screen.getByText('follow'));
            expect(pos().x).toBe(0);
        });
    });
});



