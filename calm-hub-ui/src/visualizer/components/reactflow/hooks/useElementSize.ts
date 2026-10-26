import { useLayoutEffect, useState } from 'react';

export interface ElementSize {
    width: number;
    height: number;
}

/**
 * An element's layout size, kept current as it resizes. Inside the diagram this is in flow units, as the viewport's
 * zoom is a transform and does not change it. Undefined for no element, or one not laid out yet.
 */
export function useElementSize(element: HTMLElement | null): ElementSize | undefined {
    const [size, setSize] = useState<ElementSize>();
    useLayoutEffect(() => {
        const measure = () => {
            const width = element?.offsetWidth ?? 0;
            const height = element?.offsetHeight ?? 0;
            setSize((old) => {
                if (!width || !height) return undefined;
                return old?.width === width && old.height === height ? old : { width, height };
            });
        };
        measure();
        if (!element) return;
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [element]);
    return size;
}
