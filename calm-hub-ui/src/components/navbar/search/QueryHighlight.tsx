import { forwardRef } from 'react';
import { segmentQuery } from '../../../model/search-query.js';

const KIND_CLASS = {
    text: 'text-base-content',
    key: 'text-primary font-semibold',
    value: 'text-accent',
    invalid: 'text-error underline decoration-wavy',
} as const;

/** Coloured copy of the query, drawn behind a transparent input with the same font and padding. */
export const QueryHighlight = forwardRef<HTMLDivElement, { query: string; className: string }>(
    function QueryHighlight({ query, className }, ref) {
        return (
            <div ref={ref} aria-hidden="true" className={`pointer-events-none overflow-hidden whitespace-pre ${className}`}>
                {segmentQuery(query).map((segment, i) => (
                    <span key={i} className={KIND_CLASS[segment.kind]}>
                        {segment.text}
                    </span>
                ))}
            </div>
        );
    }
);
