/* SPDX-License-Identifier: Apache-2.0 */
import { ReactNode, useEffect, useRef, useState } from 'react';

export function AdrMarkdownTable({ children, label }: { children: ReactNode; label: string }) {
    const regionRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
        const region = regionRef.current!;
        const table = tableRef.current!;
        const measure = () => setOverflows(region.scrollWidth > region.clientWidth);
        measure();
        window.addEventListener('resize', measure);
        const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
        observer?.observe(region);
        observer?.observe(table);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [children]);

    return (
        <div ref={regionRef} className="adr-markdown-table" role="region" aria-label={label} tabIndex={overflows ? 0 : undefined}>
            <table ref={tableRef}>{children}</table>
        </div>
    );
}
