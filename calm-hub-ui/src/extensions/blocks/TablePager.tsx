interface TablePagerProps {
    page: number;
    pages: number;
    /** Moves this many pages: -1 or 1. */
    onMove: (delta: number) => void;
    controls: string;
}

/** aria-disabled, not disabled: a button that becomes disabled on the last page must keep focus. */
export function TablePager({ page, pages, onMove, controls }: TablePagerProps) {
    const first = page <= 1;
    const last = page >= pages;
    return (
        <nav aria-label="Table pages" className="flex items-center gap-2 text-sm">
            <button
                type="button"
                className={`btn btn-sm${first ? ' btn-disabled' : ''}`}
                aria-disabled={first}
                aria-controls={controls}
                onClick={() => !first && onMove(-1)}
            >
                Previous
            </button>
            <span>
                Page {page} of {pages}
            </span>
            <button
                type="button"
                className={`btn btn-sm${last ? ' btn-disabled' : ''}`}
                aria-disabled={last}
                aria-controls={controls}
                onClick={() => !last && onMove(1)}
            >
                Next
            </button>
        </nav>
    );
}
