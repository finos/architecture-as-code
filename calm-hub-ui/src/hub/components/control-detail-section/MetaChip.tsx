import { ReactNode } from 'react';

export function MetaChip({ label, value }: { label: string; value: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-xs">
            <span className="font-semibold text-base-content/50">{label}</span>
            <span className="font-mono text-base-content/80">{value}</span>
        </span>
    );
}

/** Single-token pill for enum / const values. */
export function ValueChip({ children }: { children: ReactNode }) {
    return (
        <span className="inline-block rounded bg-base-200 px-1.5 py-0.5 text-xs font-mono text-base-content/80">
            {children}
        </span>
    );
}

export function RequiredBadge() {
    return <span className="badge badge-xs badge-warning">required</span>;
}
