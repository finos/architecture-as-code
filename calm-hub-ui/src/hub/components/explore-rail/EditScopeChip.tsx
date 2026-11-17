import { X } from 'lucide-react';
import { colors } from '../../../theme/colors.js';

interface EditScopeChipProps {
    onClear: () => void;
}

/** Shows that the Can edit filter is on, with a button that clears it. */
export function EditScopeChip({ onClear }: EditScopeChipProps) {
    return (
        <span
            className="inline-flex items-center gap-1 pl-2 pr-1 h-6 rounded-[6px] text-[12px] font-semibold"
            style={{ backgroundColor: colors.redesign.tintBg, color: colors.redesign.activeText }}
        >
            Can edit
            <button
                type="button"
                aria-label="Clear the Can edit filter"
                onClick={onClear}
                className="inline-flex items-center justify-center border-0 bg-transparent cursor-pointer p-0.5 rounded"
                style={{ color: colors.redesign.activeText }}
            >
                <X size={12} />
            </button>
        </span>
    );
}
