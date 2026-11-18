import type { ChangeEvent, InputHTMLAttributes, RefObject } from 'react';
import { QueryHighlight } from './QueryHighlight.js';

type NativeInputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'onFocus' | 'onScroll' | 'onSelect' | 'className' | 'ref'
>;

interface AssistedSearchInputProps extends NativeInputProps {
    query: string;
    inputRef: RefObject<HTMLInputElement | null>;
    highlightRef: RefObject<HTMLDivElement | null>;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onFocus: () => void;
    onSyncScroll: () => void;
    /** Sizing for the box, e.g. `w-28 lg:w-80` or `flex-1 min-w-0`. */
    wrapperClassName: string;
    /** Font size and line height; the highlight must use the same. */
    textClassName: string;
}

/** A search input whose `namespace:` and `type:` qualifiers are coloured as you type. */
export function AssistedSearchInput({
    query,
    inputRef,
    highlightRef,
    onChange,
    onFocus,
    onSyncScroll,
    wrapperClassName,
    textClassName,
    ...inputProps
}: AssistedSearchInputProps) {
    return (
        <div className={`relative ${wrapperClassName}`}>
            <QueryHighlight ref={highlightRef} query={query} className={`absolute inset-0 ${textClassName}`} />
            <input
                {...inputProps}
                ref={inputRef}
                type="text"
                className={`relative w-full bg-transparent border-none outline-none p-0 text-transparent caret-base-content placeholder:text-base-content/40 ${textClassName}`}
                spellCheck={false}
                autoComplete="off"
                value={query}
                onChange={onChange}
                onFocus={onFocus}
                onScroll={onSyncScroll}
                onSelect={onSyncScroll}
            />
        </div>
    );
}
