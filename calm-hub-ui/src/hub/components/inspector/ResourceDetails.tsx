import type { Data } from '../../../model/calm.js';

interface ResourceDetailsProps {
    data: Data;
    displayName?: string;
    /** The diagram shows a dropped file, not the loaded resource. */
    dropped?: boolean;
}

const count = (value: unknown) => (Array.isArray(value) ? value.length : undefined);

/** The Details of the inspector when no node or relationship is selected: the resource on the diagram. */
export function ResourceDetails({ data, displayName, dropped }: ResourceDetailsProps) {
    const hint = <p className="text-sm text-base-content/60">Select a node or relationship on the diagram to see its details.</p>;
    if (dropped) return <div className="flex flex-col gap-3 p-4">{hint}</div>;
    const document = data.data as { nodes?: unknown; relationships?: unknown } | undefined;
    const rows: [string, string | number | undefined][] = [
        ['Namespace', data.name],
        ['Version', data.version],
        // A pattern nests its nodes under `properties`, so only an architecture gives counts.
        ['Nodes', data.calmType === 'Architectures' ? count(document?.nodes) : undefined],
        ['Relationships', data.calmType === 'Architectures' ? count(document?.relationships) : undefined],
    ];
    return (
        <div className="flex flex-col gap-3 p-4 overflow-auto">
            <div>
                <h2 className="text-lg font-bold text-base-content">{displayName || data.id}</h2>
                <p className="text-xs text-base-content/40 font-mono break-all">{data.id}</p>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                {rows
                    .filter(([, value]) => value !== undefined)
                    .map(([label, value]) => (
                        <div key={label} className="contents">
                            <dt className="text-base-content/50 font-medium">{label}</dt>
                            <dd className="text-base-content font-medium break-all">{value}</dd>
                        </div>
                    ))}
            </dl>
            {hint}
        </div>
    );
}
