import { useId, useRef, useState } from 'react';
import { MarkdownBlock } from '../blocks/MarkdownBlock.js';

/** Keep ordinary search results within reach without clipping focusable Markdown links. */
export function ChatAnswerText({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false);
    const contentId = useId();
    const button = useRef<HTMLButtonElement>(null);
    const long = text.length > 300 || text.split('\n').length > 4;
    const prefix = text.slice(0, 300).split('\n').slice(0, 4).join('\n');
    const excerpt = prefix.slice(0, Math.max(prefix.lastIndexOf(' '), prefix.length - 80));
    return (
        <div>
            {long && !expanded && <MarkdownBlock text={`${excerpt}…`} headingLevel={2} />}
            <div id={contentId} hidden={long && !expanded}>
                <MarkdownBlock text={text} headingLevel={2} />
            </div>
            {long && (
                <button
                    ref={button}
                    type="button"
                    className="btn btn-outline btn-sm mt-3"
                    aria-expanded={expanded}
                    aria-controls={contentId}
                    onClick={() => {
                        setExpanded(!expanded);
                        if (expanded) requestAnimationFrame(() => button.current?.scrollIntoView({ block: 'nearest' }));
                    }}
                >
                    {expanded ? 'Show less' : 'Show more'}
                </button>
            )}
        </div>
    );
}
