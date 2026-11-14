import { ReactNode } from 'react';

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** A heading whose level comes from where it is placed, so the outline stays in order. */
export function Heading({ level, className, children }: { level: HeadingLevel; className?: string; children: ReactNode }) {
    const Tag = `h${level}` as const;
    return <Tag className={className}>{children}</Tag>;
}
