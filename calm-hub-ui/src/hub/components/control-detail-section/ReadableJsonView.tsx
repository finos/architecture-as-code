import { ReactNode } from 'react';

interface ReadableJsonViewProps {
    json?: object;
}

/** Basic typed-value renderer used by the generic {@link ReadableJsonView}. */
function DefaultValue({ value }: { value: unknown }) {
    if (value === null) {
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
        return <span className="text-[var(--calm-redesign-active-text)]">{value}</span>;
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-base-content/40 italic">empty list</span>;
        }
        return (
            <ul className="list-disc list-inside ml-2">
                {value.map((item, i) => (
                    <li key={i}>
                        <DefaultValue value={item} />
                    </li>
                ))}
            </ul>
        );
    }
    if (typeof value === 'object') {
        return <JsonTree data={value as Record<string, unknown>} />;
    }
    return <span>{String(value)}</span>;
}

/**
 * Generic key/value renderer for an arbitrary object. Used as the fallback path
 * of {@link ReadableControlDoc} and directly by InterfaceDetailSection — nothing
 * is ever hidden. Callers that want richer value rendering (URL links, string
 * arrays as bullet lists) pass their own `renderValue`.
 */
export function JsonTree({
    data,
    renderValue,
}: {
    data: Record<string, unknown>;
    renderValue?: (value: unknown) => ReactNode;
}) {
    const entries = Object.entries(data);
    if (entries.length === 0) {
        return <span className="text-base-content/40 italic">empty object</span>;
    }
    const render = renderValue ?? ((value: unknown) => <DefaultValue value={value} />);
    return (
        <table className="table table-sm w-full">
            <tbody>
                {entries.map(([key, value]) => {
                    const isComplex = typeof value === 'object' && value !== null;
                    return (
                        <tr key={key} className="border-b border-base-300 align-top">
                            <td className="font-semibold text-base-content/80 whitespace-nowrap pr-4 py-2 w-48">
                                {key}
                            </td>
                            <td className={`py-2 ${isComplex ? 'pl-2' : ''}`}>{render(value)}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export function ReadableJsonView({ json }: ReadableJsonViewProps) {
    if (!json) {
        return (
            <div className="text-center w-full h-full p-6 text-base-content/60">
                Please select a document to load.
            </div>
        );
    }

    return (
        <div className="p-4 overflow-auto h-full" data-testid="readable-json-view">
            <JsonTree data={json as Record<string, unknown>} />
        </div>
    );
}
