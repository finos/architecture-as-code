import { IoGridOutline, IoListOutline, IoSearchOutline } from 'react-icons/io5';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import { type ViewMode } from './useViewMode.js';

interface ItemsToolbarProps {
    filter: string;
    onFilterChange: (value: string) => void;
    /** Plural label for the active type, used in the filter placeholder. */
    pluralLabel: string;
    view: ViewMode;
    onViewChange: (view: ViewMode) => void;
}

const VIEW_OPTIONS: { mode: ViewMode; label: string; Icon: typeof IoGridOutline }[] = [
    { mode: 'tiles', label: 'Tile view', Icon: IoGridOutline },
    { mode: 'list', label: 'List view', Icon: IoListOutline },
];

/**
 * Filter box + tiles/list toggle above the namespace item area.
 */
export function ItemsToolbar({ filter, onFilterChange, pluralLabel, view, onViewChange }: ItemsToolbarProps) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div
                className="flex items-center h-8 px-2 gap-1.5 w-full max-w-[320px] focus-within:ring-1"
                style={{ border: `1px solid ${colors.redesign.borderStrong}`, borderRadius: redesignTokens.radius.input }}
            >
                <IoSearchOutline aria-hidden="true" style={{ color: colors.redesign.mutedAlt }} />
                <input
                    type="search"
                    data-testid="namespace-item-filter"
                    aria-label={`Filter ${pluralLabel}`}
                    placeholder={`Filter ${pluralLabel}`}
                    value={filter}
                    onChange={(e) => onFilterChange(e.target.value)}
                    className="min-w-0 flex-1 h-full text-[13px] bg-transparent outline-none"
                />
            </div>

            <div
                role="group"
                aria-label="Layout"
                className="ml-auto flex overflow-hidden"
                style={{ border: `1px solid ${colors.redesign.borderStrong}`, borderRadius: redesignTokens.radius.input }}
            >
                {VIEW_OPTIONS.map(({ mode, label, Icon }) => {
                    const selected = view === mode;
                    return (
                        <button
                            key={mode}
                            type="button"
                            data-testid={`view-toggle-${mode}`}
                            aria-label={label}
                            title={label}
                            aria-pressed={selected}
                            onClick={() => onViewChange(mode)}
                            className="h-8 w-8 flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-interaction)]"
                            style={{
                                backgroundColor: selected ? colors.redesign.tintBg : 'transparent',
                                color: selected ? colors.redesign.primaryText : colors.redesign.mutedAlt,
                                transition: redesignTokens.transition,
                            }}
                        >
                            <Icon size={16} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
