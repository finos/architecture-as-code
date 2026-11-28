import { forwardRef } from 'react';
import { SEGMENT_CLASS, segmentQuery } from '../../../model/search-query.js';

/** Coloured copy of the query, drawn behind a transparent input with the same font and padding. */
export const QueryHighlight = forwardRef<HTMLDivElement, { query: string; className: string }>(
    function QueryHighlight({ query, className }, ref) {
        return (
            <div ref={ref} aria-hidden="true" className={`pointer-events-none overflow-hidden whitespace-pre ${className}`}>
                {segmentQuery(query).map((segment, i) => (
                    <span key={i} className={SEGMENT_CLASS[segment.kind]}>
                        {segment.text}
                    </span>
                ))}
            </div>
        );
    }
);

/** The query as inline coloured text, for headings and labels. */
export function QueryText({ query }: { query: string }) {
    return (
        <span className="whitespace-pre-wrap">
            {segmentQuery(query).map((segment, i) => (
                <span key={i} className={segment.kind === 'text' ? undefined : SEGMENT_CLASS[segment.kind]}>
                    {segment.text}
                </span>
            ))}
        </span>
    );
}
