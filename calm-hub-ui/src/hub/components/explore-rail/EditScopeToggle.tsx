import { colors } from '../../../theme/colors.js';
import { redesignTokens } from '../../../theme/redesign-tokens.js';

export type EditScope = 'all' | 'editable';

const OPTIONS: { value: EditScope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'editable', label: 'Can edit' },
];

interface EditScopeToggleProps {
    scope: EditScope;
    onChange: (scope: EditScope) => void;
}

export function EditScopeToggle({ scope, onChange }: EditScopeToggleProps) {
    return (
        <div
            role="group"
            aria-label="Scope"
            className="flex w-full p-0.5 rounded-[7px]"
            style={{ border: `1px solid ${colors.redesign.borderStrong}` }}
        >
            {OPTIONS.map((option) => {
                const selected = option.value === scope;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(option.value)}
                        className={`flex-1 h-6 text-[12px] rounded-[5px] border-0 cursor-pointer ${selected ? 'font-semibold' : ''}`}
                        style={{
                            backgroundColor: selected ? colors.redesign.tintBg : 'transparent',
                            color: selected ? colors.redesign.activeText : colors.redesign.bodyAlt,
                            transition: redesignTokens.transition,
                        }}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
