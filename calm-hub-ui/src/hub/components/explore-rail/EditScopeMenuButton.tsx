import { FocusEvent, useState } from 'react';
import { Check, Funnel } from 'lucide-react';
import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';
import type { EditScope } from './useEditScope.js';

const OPTIONS: { value: EditScope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'editable', label: 'Can edit' },
];

interface EditScopeMenuButtonProps {
    scope: EditScope;
    onChange: (scope: EditScope) => void;
    /** Pixel size of the square button. */
    size?: number;
}

/** A filter button whose menu picks which namespaces and control domains to show. */
export function EditScopeMenuButton({ scope, onChange, size = 24 }: EditScopeMenuButtonProps) {
    const [open, setOpen] = useState(false);
    const active = scope === 'editable';

    const choose = (value: EditScope) => {
        setOpen(false);
        onChange(value);
    };

    // Close when focus leaves the button and its menu, e.g. a click elsewhere on the page.
    const closeOnFocusLeave = (event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    };

    return (
        <div
            className="relative shrink-0"
            onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
            onBlur={closeOnFocusLeave}
        >
            <button
                type="button"
                aria-label="Filter options"
                title="Filter options"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="flex items-center justify-center rounded-[6px] border-0 cursor-pointer"
                style={{
                    width: size,
                    height: size,
                    backgroundColor: active ? colors.redesign.tintBg : 'transparent',
                    color: active || open ? colors.redesign.primaryText : colors.redesign.mutedAlt,
                    transition: redesignTokens.transition,
                }}
            >
                <Funnel size={Math.round(size * 0.6)} />
            </button>
            {open && (
                <div
                    role="menu"
                    aria-label="Show"
                    className="absolute right-0 z-20 flex flex-col p-1 rounded-[8px] shadow-md"
                    style={{
                        top: 'calc(100% + 4px)',
                        minWidth: 160,
                        backgroundColor: colors.redesign.surface,
                        border: `1px solid ${colors.redesign.border}`,
                    }}
                >
                    <span className="px-3 pt-1 pb-1 text-[11px]" style={{ color: colors.redesign.mutedAlt }} aria-hidden="true">
                        Show
                    </span>
                    {OPTIONS.map((option) => {
                        const checked = option.value === scope;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={checked}
                                onClick={() => choose(option.value)}
                                className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-left rounded hover:bg-base-200 border-0 bg-transparent cursor-pointer"
                                style={{ color: colors.redesign.ink }}
                            >
                                <span className="inline-flex shrink-0" style={{ width: 14 }} aria-hidden="true">
                                    {checked && <Check size={14} color={colors.redesign.primaryText} />}
                                </span>
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
