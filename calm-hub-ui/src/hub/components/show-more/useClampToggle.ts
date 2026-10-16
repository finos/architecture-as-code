import { useLayoutEffect, useRef, useState } from 'react';

const CLAMP_LINES = 2;

/**
 * True when the text needs more than the clamped number of lines. Counting lines from the
 * line height gives the same answer whether the text is clamped or expanded, so a rotation
 * can retire a "Show less" that is no longer needed. Without a numeric line height, only
 * clamped text can be measured.
 */
function isCutOff(el: HTMLElement): boolean {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    if (Number.isNaN(lineHeight)) return el.scrollHeight > el.clientHeight;
    // The extra pixel absorbs sub-pixel rounding of the line boxes.
    return el.scrollHeight > CLAMP_LINES * lineHeight + 1;
}

/**
 * Expand/collapse state for text clamped to two lines. The toggle shows only when the text
 * needs more than two lines, which is measured, so short text gets no toggle. `active` is
 * false where the layout has no toggle (desktop), and re-measures when the layout switches.
 *
 * The measure repeats when the text box resizes (a phone rotation) and when a web font
 * finishes loading. A font can re-wrap the text without resizing the clamped box.
 */
export function useClampToggle<T extends HTMLElement>(text: string, active: boolean) {
    const ref = useRef<T>(null);
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => setClamped(isCutOff(el));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        document.fonts?.addEventListener('loadingdone', measure);
        return () => {
            observer.disconnect();
            document.fonts?.removeEventListener('loadingdone', measure);
        };
    }, [text, expanded, active]);

    return {
        ref,
        expanded,
        showToggle: active && clamped,
        toggle: () => setExpanded((e) => !e),
    };
}
