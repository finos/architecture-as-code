import { Ref } from 'react';
import { SearchInput } from './SearchInput.js';

interface TableToolbarProps {
    /** The result line: the number of rows and the filters that apply. A live region, so a change is announced. */
    summary: string;
    filtered: boolean;
    onClear: () => void;
    /** The DOM id of the table. */
    controls: string;
    search?: {
        label: string;
        value: string;
        resetKey: string;
        delay: number;
        onCommit: (text: string) => void;
        /** The DOM id of a message that says what is wrong with the search text. */
        problem?: string;
    };
    searchRef: Ref<HTMLInputElement>;
    /** The page URL has no room for the filters of this table. */
    overflowed: boolean;
}

export function TableToolbar({ summary, filtered, onClear, controls, search, searchRef, overflowed }: TableToolbarProps) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p role="status" className="min-w-0 text-sm text-base-content/70 wrap-anywhere">
                    {summary}
                </p>
                {filtered && (
                    <button type="button" className="btn btn-link btn-sm px-0" aria-controls={controls} onClick={onClear}>
                        Clear filters
                    </button>
                )}
                {search && (
                    <div className="w-full @md:w-auto @md:ml-auto">
                        <SearchInput
                            ref={searchRef}
                            label={search.label}
                            value={search.value}
                            resetKey={search.resetKey}
                            delay={search.delay}
                            onCommit={search.onCommit}
                            controls={controls}
                            problem={search.problem}
                        />
                    </div>
                )}
            </div>
            {overflowed && <p className="text-xs text-base-content/60">These filters are not kept in the page address.</p>}
        </div>
    );
}
