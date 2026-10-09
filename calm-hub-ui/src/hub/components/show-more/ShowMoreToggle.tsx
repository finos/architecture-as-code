import { colors } from '../../../theme/colors.js';

interface ShowMoreToggleProps {
    expanded: boolean;
    onToggle: () => void;
}

/** The "Show more" / "Show less" button under clamped text on touch screens, which have no hover. */
export function ShowMoreToggle({ expanded, onToggle }: ShowMoreToggleProps) {
    return (
        <button
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            className="mt-1 self-start text-[13px] font-medium bg-transparent border-0 p-0 cursor-pointer"
            style={{ color: colors.redesign.primaryText }}
        >
            {expanded ? 'Show less' : 'Show more'}
        </button>
    );
}
