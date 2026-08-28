interface OptionSelectProps {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

/**
 * Compact version / configuration picker. Renders nothing when there is one
 * option or none, so single-version controls show no chrome.
 */
export function OptionSelect({ label, options, value, onChange, className }: OptionSelectProps) {
    if (options.length <= 1) return null;
    return (
        <select
            className={`select select-sm select-bordered ${className ?? ''}`}
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {options.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
