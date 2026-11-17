import { ExtensionFormField } from '../../model/extensions.js';
import { FieldValue, maxLength } from './formRules.js';

interface FormFieldInputProps {
    field: ExtensionFormField;
    /** The DOM id of the control. Its help and error take the same id with a suffix. */
    id: string;
    value: FieldValue;
    error?: string;
    onChange: (value: FieldValue) => void;
}

/** One field of a form block. Each control has a visible label, and its help and error are in its description. */
export function FormFieldInput({ field, id, value, error, onChange }: FormFieldInputProps) {
    const helpId = `${id}-help`;
    const errorId = `${id}-error`;
    const text = typeof value === 'string' ? value : '';
    const counter =
        field.type === 'multiline' && field.maxLength !== undefined ? `${text.length} of ${maxLength(field)} characters` : undefined;
    const help = [field.help, counter].filter(Boolean).join(' · ');
    const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined;
    const aria = {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': field.required || undefined,
    };
    const errorText = error && (
        <p id={errorId} className="text-xs text-error">
            {error}
        </p>
    );
    const helpText = help && (
        <p id={helpId} className="text-xs text-base-content/60">
            {help}
        </p>
    );

    if (field.type === 'checkbox') {
        return (
            <div className="flex flex-col gap-1">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                        {...aria}
                        type="checkbox"
                        className={`checkbox checkbox-sm mt-0.5${error ? ' checkbox-error' : ''}`}
                        checked={value === true}
                        onChange={(event) => onChange(event.target.checked)}
                    />
                    <span>
                        {field.label}
                        {field.required && <span className="text-base-content/60"> (required)</span>}
                    </span>
                </label>
                {helpText}
                {errorText}
            </div>
        );
    }

    const invalid = error ? ' input-error' : '';
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <label htmlFor={id} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="font-normal text-base-content/60"> (required)</span>}
            </label>
            {field.type === 'multiline' ? (
                <textarea
                    {...aria}
                    className={`textarea w-full min-h-24${error ? ' textarea-error' : ''}`}
                    value={text}
                    maxLength={maxLength(field)}
                    onChange={(event) => onChange(event.target.value)}
                />
            ) : field.type === 'choice' ? (
                <select
                    {...aria}
                    className={`select w-full${error ? ' select-error' : ''}`}
                    value={text}
                    onChange={(event) => onChange(event.target.value)}
                >
                    {/* An empty value, so that a required choice with no default needs a choice. */}
                    {(text === '' || !field.required) && <option value="">{field.required ? 'Choose an option' : 'None'}</option>}
                    {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : (
                <input
                    {...aria}
                    type="text"
                    inputMode={field.type === 'number' ? (field.integer ? 'numeric' : 'decimal') : undefined}
                    className={`input w-full${invalid}`}
                    value={text}
                    maxLength={field.type === 'text' ? maxLength(field) : undefined}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
            {helpText}
            {errorText}
        </div>
    );
}
