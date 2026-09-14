import { JsonTree } from './ReadableJsonView.js';
import { ExternalLink } from './ExternalLink.js';
import { isStringArray, isUrlString } from './control-doc-utils.js';

/**
 * Renders one JSON *value* (not a keyed row). Keeps the typed-value treatment
 * used across the app: boolean badges, mono numbers, accent-coloured strings —
 * plus URL detection (string -> external link) and string-array bullet lists.
 */
export function ReadableValue({ value }: { value: unknown }) {
    if (value === null || value === undefined) {
        return <span className="text-base-content/40 italic">null</span>;
    }
    if (typeof value === 'boolean') {
        return (
            <span className={`badge badge-sm ${value ? 'badge-success' : 'badge-error'}`}>
                {String(value)}
            </span>
        );
    }
    if (typeof value === 'number') {
        return <span className="text-info font-mono">{value}</span>;
    }
    if (typeof value === 'string') {
        if (isUrlString(value)) {
            return <ExternalLink href={value} />;
        }
        return (
            <span className="text-[var(--calm-redesign-active-text)] whitespace-pre-wrap">
                {value}
            </span>
        );
    }
    if (isStringArray(value)) {
        return (
            <ul className="list-disc list-inside ml-2 space-y-0.5">
                {value.map((item, i) => (
                    <li key={i}>
                        <ReadableValue value={item} />
                    </li>
                ))}
            </ul>
        );
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-base-content/40 italic">empty list</span>;
        }
        return (
            <ul className="list-disc list-inside ml-2">
                {value.map((item, i) => (
                    <li key={i}>
                        <ReadableValue value={item} />
                    </li>
                ))}
            </ul>
        );
    }
    if (typeof value === 'object') {
        return (
            <JsonTree
                data={value as Record<string, unknown>}
                renderValue={(v) => <ReadableValue value={v} />}
            />
        );
    }
    return <span>{String(value)}</span>;
}
