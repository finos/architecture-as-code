import { Suggestion } from '../../../model/search-query.js';
import { colors } from '../../../theme/colors.js';

interface SearchSuggestionListProps {
    listboxId: string;
    suggestions: Suggestion[];
    selectedIndex: number;
    optionId: (index: number) => string;
    onAccept: (suggestion: Suggestion) => void;
}

export function SearchSuggestionList({ listboxId, suggestions, selectedIndex, optionId, onAccept }: SearchSuggestionListProps) {
    return (
        <>
            <div id={listboxId} role="listbox">
                {suggestions.map((s, i) => (
                    <button
                        key={s.label}
                        id={optionId(i)}
                        role="option"
                        aria-selected={i === selectedIndex}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-baseline gap-2 hover:bg-base-200 cursor-pointer ${
                            i === selectedIndex ? 'bg-base-200' : ''
                        }`}
                        // mousedown, so the input keeps focus.
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onAccept(s);
                        }}
                    >
                        <span className="font-mono-jb text-xs text-primary">{s.label}</span>
                        {s.description && (
                            <span className="text-xs truncate" style={{ color: colors.redesign.mutedAlt }}>
                                {s.description}
                            </span>
                        )}
                    </button>
                ))}
            </div>
            <div
                className="px-3 py-1 font-mono-jb text-[10px] border-t border-base-300"
                style={{ color: colors.redesign.faintAlt }}
            >
                Tab or Enter to accept · ↑↓ to move
            </div>
        </>
    );
}
