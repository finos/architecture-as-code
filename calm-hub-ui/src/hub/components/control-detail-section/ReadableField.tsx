import { ReadableValue } from './ReadableValue.js';
import { formatFieldName, isStringArray } from './control-doc-utils.js';

/**
 * A keyed row for prose-flavour requirement docs and configuration instances.
 * String arrays render as a labelled bullet list; everything else as a
 * label / value pair.
 */
export function ReadableField({ name, value }: { name: string; value: unknown }) {
    if (isStringArray(value)) {
        return (
            <div>
                <p className="text-xs font-semibold text-base-content/50 mb-1">
                    {formatFieldName(name)}
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    {value.map((v, i) => (
                        <li key={i}>
                            <ReadableValue value={v} />
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
            <span className="text-xs font-medium text-base-content/50 min-w-32">
                {formatFieldName(name)}
            </span>
            <span className="min-w-0">
                <ReadableValue value={value} />
            </span>
        </div>
    );
}
