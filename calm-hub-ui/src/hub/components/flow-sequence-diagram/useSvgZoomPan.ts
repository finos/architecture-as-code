import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ZoomPanTransform {
    scale: number;
    x: number;
    y: number;
}

/** Visible portion of the diagram, as 0-1 fractions of its full size. */
export interface ViewportFraction {
    left: number;
    top: number;
    width: number;
    height: number;
}

export const IDENTITY_TRANSFORM: ZoomPanTransform = { scale: 1, x: 0, y: 0 };

const FULL_VIEWPORT: ViewportFraction = { left: 0, top: 0, width: 1, height: 1 };

export const MIN_SCALE = 0.4;
export const MAX_SCALE = 3;

/** Wheel deltas change with the device. Convert them to an exponential factor. */
const WHEEL_SENSITIVITY = 0.0015;

/** A fixed ratio keeps repeated button clicks even. */
const BUTTON_STEP = 1.2;

/** Slack allowed before the content overflows its pane. */
const OVERFLOW_EPSILON = 1;

/** Band at the pane edge. A followed target inside it counts as off-screen. */
const FOLLOW_MARGIN = 24;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Wheel-zoom and drag-pan for a fixed-size child. The transform applies to a
 * wrapper element in screen space, not inside the SVG viewBox. Pixel offsets and
 * viewBox units do not mix: the anchor calculation fails at any scale except 1.
 */
export function useSvgZoomPan() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    /** The scaled content. Measured to find which part is on screen. */
    const contentRef = useRef<SVGSVGElement | null>(null);
    const [transform, setTransform] = useState<ZoomPanTransform>(IDENTITY_TRANSFORM);
    const panOrigin = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    // Mirrors ReactFlow's "toggle interactivity" lock on the architecture tab.
    const [isInteractive, setIsInteractive] = useState(true);
    const [viewport, setViewport] = useState<ViewportFraction>(FULL_VIEWPORT);

    // The geometry helpers must measure the DOM, which is not permitted inside a
    // state updater. This ref gives them the current transform instead.
    const transformRef = useRef(transform);
    useEffect(() => {
        transformRef.current = transform;
    });

    /**
     * Live geometry of the scaled content. `base*` and `offset*` are the untransformed
     * size and inset. They come from the measured box, so no code must repeat the
     * preserveAspectRatio fit or the padding.
     */
    const measure = useCallback(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return null;

        const pane = container.getBoundingClientRect();
        const box = content.getBoundingClientRect();
        if (!box.width || !box.height) return null;

        const current = transformRef.current;
        return {
            pane,
            box,
            baseW: box.width / current.scale,
            baseH: box.height / current.scale,
            offsetX: (box.left - pane.left - current.x) / current.scale,
            offsetY: (box.top - pane.top - current.y) / current.scale,
        };
    }, []);

    /**
     * Keeps the diagram anchored to the pane. If it is larger than the pane, you can
     * pan it but not past its own edges. If it fits, you cannot drag it out of view.
     */
    const clampTransform = useCallback(
        (next: ZoomPanTransform): ZoomPanTransform => {
            const geometry = measure();
            if (!geometry) return next;

            const { pane, baseW, baseH, offsetX, offsetY } = geometry;
            const width = baseW * next.scale;
            const height = baseH * next.scale;

            // Flush-start and flush-end offsets. Which one is the lower bound changes
            // if the content is larger than the pane.
            const xStart = -offsetX * next.scale;
            const xEnd = pane.width - width - offsetX * next.scale;
            const yStart = -offsetY * next.scale;
            const yEnd = pane.height - height - offsetY * next.scale;

            return {
                scale: next.scale,
                x: clamp(next.x, Math.min(xStart, xEnd), Math.max(xStart, xEnd)),
                y: clamp(next.y, Math.min(yStart, yEnd), Math.max(yStart, yEnd)),
            };
        },
        [measure]
    );

    /** Keeps the point under the cursor fixed while the scale changes. */
    const zoomAbout = useCallback(
        (clientX: number, clientY: number, factor: number) => {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const px = clientX - rect.left;
            const py = clientY - rect.top;

            const current = transformRef.current;
            const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
            if (scale === current.scale) return;
            const ratio = scale / current.scale;

            setTransform(
                clampTransform({
                    scale,
                    x: px - ratio * (px - current.x),
                    y: py - ratio * (py - current.y),
                })
            );
        },
        [clampTransform]
    );

    // React's wheel listener is passive, so preventDefault() has no effect there and
    // the page scrolls during zoom. Register the listener natively instead.
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !isInteractive) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            zoomAbout(e.clientX, e.clientY, Math.exp(-e.deltaY * WHEEL_SENSITIVITY));
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [zoomAbout, isInteractive]);

    // The slice of the diagram on screen, for the minimap. preserveAspectRatio fits
    // the SVG, then CSS transforms it. Measurement is easier than a calculation that
    // repeats both steps.
    useLayoutEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const pane = container.getBoundingClientRect();
        const box = content.getBoundingClientRect();
        if (!box.width || !box.height) return;

        setViewport({
            left: clamp((pane.left - box.left) / box.width, 0, 1),
            top: clamp((pane.top - box.top) / box.height, 0, 1),
            width: clamp(pane.width / box.width, 0, 1),
            height: clamp(pane.height / box.height, 0, 1),
        });
    }, [transform]);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            // Primary button only. This must not block context menus or back/forward.
            if (e.button !== 0 || !isInteractive) return;
            panOrigin.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
            setIsPanning(true);
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        [transform.x, transform.y, isInteractive]
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const origin = panOrigin.current;
            if (!origin) return;
            setTransform(
                clampTransform({
                    ...transformRef.current,
                    x: origin.tx + (e.clientX - origin.x),
                    y: origin.ty + (e.clientY - origin.y),
                })
            );
        },
        [clampTransform]
    );

    const endPan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!panOrigin.current) return;
        panOrigin.current = null;
        setIsPanning(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    }, []);

    /** Buttons zoom about the pane centre, because there is no cursor to anchor to. */
    const zoomByButton = useCallback(
        (factor: number) => {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            zoomAbout(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
        },
        [zoomAbout]
    );

    /**
     * Centres the target if it is not already well inside the pane. Takes a selector
     * because a step can be parallel: many messages share one sequence number. The
     * function centres their union box, not one message.
     */
    const panIntoView = useCallback(
        (selector: string) => {
            const container = containerRef.current;
            if (!container) return;

            const geometry = measure();
            if (!geometry) return;

            // Do not re-centre while the whole diagram is on screen. It moves the view
            // for no reason.
            const { pane, box } = geometry;
            if (
                box.width <= pane.width + OVERFLOW_EPSILON &&
                box.height <= pane.height + OVERFLOW_EPSILON
            ) {
                return;
            }

            const targets = [...container.querySelectorAll(selector)];
            if (targets.length === 0) return;

            const union = targets.reduce(
                (acc, el) => {
                    const rect = el.getBoundingClientRect();
                    return {
                        left: Math.min(acc.left, rect.left),
                        right: Math.max(acc.right, rect.right),
                        top: Math.min(acc.top, rect.top),
                        bottom: Math.max(acc.bottom, rect.bottom),
                    };
                },
                { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
            );
            if (!Number.isFinite(union.left) || union.right === union.left) return;

            const visible =
                union.top >= pane.top + FOLLOW_MARGIN &&
                union.bottom <= pane.bottom - FOLLOW_MARGIN &&
                union.left >= pane.left + FOLLOW_MARGIN &&
                union.right <= pane.right - FOLLOW_MARGIN;
            if (visible) return;

            const current = transformRef.current;
            setTransform(
                clampTransform({
                    ...current,
                    x: current.x + (pane.left + pane.width / 2 - (union.left + union.right) / 2),
                    y: current.y + (pane.top + pane.height / 2 - (union.top + union.bottom) / 2),
                })
            );
        },
        [measure, clampTransform]
    );

    const zoomIn = useCallback(() => zoomByButton(BUTTON_STEP), [zoomByButton]);
    const zoomOut = useCallback(() => zoomByButton(1 / BUTTON_STEP), [zoomByButton]);
    const reset = useCallback(() => setTransform(IDENTITY_TRANSFORM), []);
    const toggleInteractive = useCallback(() => setIsInteractive((v) => !v), []);

    /** Centres the diagram point at the given 0-1 fractions. Used by the minimap. */
    const panToFraction = useCallback(
        (fx: number, fy: number) => {
            const geometry = measure();
            if (!geometry) return;

            const { pane, box } = geometry;
            const current = transformRef.current;
            setTransform(
                clampTransform({
                    ...current,
                    x: current.x + (pane.left + pane.width / 2 - (box.left + fx * box.width)),
                    y: current.y + (pane.top + pane.height / 2 - (box.top + fy * box.height)),
                })
            );
        },
        [measure, clampTransform]
    );

    return {
        containerRef,
        contentRef,
        transform,
        isPanning,
        isInteractive,
        viewport,
        panHandlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endPan,
            onPointerCancel: endPan,
        },
        panIntoView,
        panToFraction,
        toggleInteractive,
        zoomIn,
        zoomOut,
        reset,
    };
}

