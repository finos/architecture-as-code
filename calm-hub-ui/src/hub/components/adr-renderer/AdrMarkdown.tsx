/* SPDX-License-Identifier: Apache-2.0 */
import { MouseEvent, useId, useMemo } from 'react';
import Markdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AdrMarkdownTable } from './AdrMarkdownTable.js';
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

export function AdrMarkdown({ children, label = 'ADR' }: { children?: string; label?: string }) {
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
            table: ({ node, children }) => (
                <AdrMarkdownTable label={`${label} table at line ${node?.position?.start.line ?? 1}`}>{children}</AdrMarkdownTable>
            ),
        }),
        [label, prefix]
    );

    return (
        <div className="adr-markdown">
            <Markdown remarkPlugins={[remarkGfm]} remarkRehypeOptions={{ clobberPrefix: prefix }} components={components}>
                {children}
            </Markdown>
        </div>
    );
}
