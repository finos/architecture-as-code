import { forwardRef, useEffect, useState } from 'react';
import { SCREEN_STATE_LIMITS } from '../../navigation/destinations.js';

interface SearchInputProps {
    label: string;
    /** The search text of the table's newest filters. */
    value: string;
    /**
     * Changes when the filters are set again from outside the box, such as by Clear filters or a link. The box then
     * shows `value`, and drops text that it did not commit yet.
     */
    resetKey: string;
    /** How long typing must stop before the text filters the table. */
    delay: number;
    onCommit: (text: string) => void;
    controls: string;
    /** The DOM id of a message that says what is wrong with the text. */
    problem?: string;
}

// The page address keeps at most `tableQuery` characters (code points). An HTML maxLength counts UTF-16 units, so it
// would refuse half of them for a character such as '𝄞'. The box cuts the text at a character instead.
const MAX_CHARS = SCREEN_STATE_LIMITS.tableQuery;
const withinMax = (text: string) => (text.length <= MAX_CHARS ? text : Array.from(text).slice(0, MAX_CHARS).join(''));

/**
 * The input keeps its own text, so a slow filter update cannot move the caret or drop a key press. Only `resetKey`
 * replaces the text: a `value` that changes because of a commit of this box can arrive after more typing.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
    { label, value, resetKey, delay, onCommit, controls, problem },
    ref
) {
    const [text, setText] = useState(value);
    const [reset, setReset] = useState(resetKey);
    if (resetKey !== reset) {
        setReset(resetKey);
        setText(value);
    }
    useEffect(() => {
        if (text === value) return;
        const timer = setTimeout(() => onCommit(text), delay);
        return () => clearTimeout(timer);
    }, [text, value, delay, onCommit]);
    return (
        <label className="input input-sm w-full @md:w-64">
            <span className="sr-only">{label}</span>
            <input
                ref={ref}
                type="search"
                value={text}
                placeholder={label}
                aria-controls={controls}
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem}
                onChange={(event) => setText(withinMax(event.target.value))}
            />
        </label>
    );
});
