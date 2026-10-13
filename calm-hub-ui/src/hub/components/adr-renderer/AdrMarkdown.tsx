/* SPDX-License-Identifier: Apache-2.0
 * Copyright 2026 Russlan Ramdowar
 */
import { MouseEvent, useId, useMemo } from 'react';
import Markdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AdrMarkdown.css';

function scrollToFragment(event: MouseEvent<HTMLAnchorElement>) {
    const href = event.currentTarget.getAttribute('href');
    if (!href?.startsWith('#')) {
        return;
    }

    // A fragment must not replace the HashRouter route, even if its target is missing.
    event.preventDefault();
    let id: string;
    try {
        id = decodeURIComponent(href.slice(1));
    } catch {
        return;
    }
    document.getElementById(id)?.scrollIntoView();
}

export function AdrMarkdown({ children }: { children?: string }) {
    const prefix = `adr-${useId()}-`;
    const components = useMemo<Components>(
        () => ({
            a: ({ node, ...props }) => (
                <a
                    {...props}
                    aria-describedby={node?.properties.dataFootnoteRef ? `${prefix}footnote-label` : props['aria-describedby']}
                    onClick={scrollToFragment}
                />
            ),
            h2: ({ node, ...props }) => (
                <h2
                    {...props}
                    id={node?.properties.id === 'footnote-label' ? `${prefix}footnote-label` : props.id}
                    className={node?.properties.id === 'footnote-label' ? 'sr-only' : props.className}
                />
            ),
            table: ({ children }) => (
                <div className="adr-markdown-table" role="region" aria-label="ADR table" tabIndex={0}>
                    <table>{children}</table>
                </div>
            ),
        }),
        [prefix]
    );

    return (
        <div className="adr-markdown">
            <Markdown remarkPlugins={[remarkGfm]} remarkRehypeOptions={{ clobberPrefix: prefix }} components={components}>
                {children}
            </Markdown>
        </div>
    );
}
