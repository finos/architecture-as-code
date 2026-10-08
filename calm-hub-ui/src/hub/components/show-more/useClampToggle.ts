import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Expand/collapse state for line-clamped text. The toggle is needed only when the clamp
 * actually cuts the text off, which is measured, so short text gets no toggle. `active` is
 * false where the layout has no toggle (desktop), and re-measures when the layout switches.
 */
export function useClampToggle<T extends HTMLElement>(text: string, active: boolean) {
    const ref = useRef<T>(null);
    const [expanded, setExpanded] = useState(false);
    const [clamped, setClamped] = useState(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight);
    }, [text, expanded, active]);

    return {
        ref,
        expanded,
        showToggle: active && (clamped || expanded),
        toggle: () => setExpanded((e) => !e),
    };
}
