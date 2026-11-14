import { ReactNode } from 'react';
import Markdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../../hub/components/adr-renderer/AdrMarkdown.css';
import { Heading, HeadingLevel } from '../Heading.js';
import { safeHref } from '../ScreenLink.js';

// Tailwind's base styles remove heading sizes, list markers and gaps, so Markdown sets its own.
const HEADING_CLASS = ['text-lg font-bold mt-4 mb-2', 'text-base font-bold mt-4 mb-2', 'text-sm font-semibold mt-3 mb-1'];

function heading(depth: number, below: HeadingLevel) {
    const level = Math.min(6, below + depth) as HeadingLevel;
    const className = HEADING_CLASS[Math.min(depth, HEADING_CLASS.length) - 1];
    return ({ children }: { children?: ReactNode }) => (
        <Heading level={level} className={className}>
            {children}
        </Heading>
    );
}

function components(below: HeadingLevel): Components {
    return {
        h1: heading(1, below),
        h2: heading(2, below),
        h3: heading(3, below),
        h4: heading(4, below),
        h5: heading(5, below),
        h6: heading(6, below),
        p: ({ children }) => <p className="my-2">{children}</p>,
        ul: ({ children }) => <ul className="my-2 list-disc ps-6">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal ps-6">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="my-2 border-l-4 border-base-300 ps-3 text-base-content/70">{children}</blockquote>,
        a: ({ href, children }) =>
            safeHref(href) ? (
                <a href={safeHref(href)} target="_blank" rel="noopener noreferrer" className="link link-primary">
                    {children}
                </a>
            ) : (
                <span>{children}</span>
            ),
        img: ({ alt }) => <span>{alt}</span>,
    };
}

/** Markdown from an extension. Its headings go below `headingLevel`, the level of the slot title. */
export function MarkdownBlock({ text, headingLevel }: { text: string; headingLevel: HeadingLevel }) {
    return (
        <div className="adr-markdown wrap-anywhere">
            <Markdown remarkPlugins={[remarkGfm]} skipHtml components={components(headingLevel)}>
                {text}
            </Markdown>
        </div>
    );
}
