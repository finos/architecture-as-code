import { useMemo, useState } from 'react';
import { IoGitNetworkOutline } from 'react-icons/io5';
import type { PatternImplementation } from '../../../../model/pattern-implementation.js';
import { ExternalLink } from '../../control-detail-section/ExternalLink.js';
import { architectureHref, countByNamespace, groupByArchitecture, plural } from './usedBy.js';

export function UsedByHeading() {
    return (
        <h2 className="flex items-center gap-2 font-semibold">
            <IoGitNetworkOutline className="shrink-0 text-[var(--color-interaction)]" aria-hidden="true" />
            Architectures that use this pattern version
        </h2>
    );
}

/** The architectures, filtered by namespace on the left (a select below the lg breakpoint) and by a text filter. */
export function UsedByList({ implementations }: { implementations: PatternImplementation[] }) {
    const architectures = useMemo(() => groupByArchitecture(implementations), [implementations]);
    const namespaces = useMemo(() => countByNamespace(architectures), [architectures]);
    const [selected, setSelected] = useState<string | null>(null);
    const [filter, setFilter] = useState('');
    const term = filter.trim().toLowerCase();
    const shown = architectures.filter(
        (a) =>
            (selected === null || a.namespace === selected) &&
            (term === '' || a.label.toLowerCase().includes(term) || a.namespace.toLowerCase().includes(term))
    );

    const namespaceButton = (namespace: string | null, label: string, count: number) => {
        const active = selected === namespace;
        return (
            <button
                key={label}
                onClick={() => setSelected(namespace)}
                aria-pressed={active}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm ${
                    active ? 'bg-[var(--color-interaction)] text-white' : 'hover:bg-base-200'
                }`}
            >
                <span className="truncate">{label}</span>
                <span className={`badge badge-sm ${active ? 'bg-white/20 text-white border-0' : 'badge-ghost'}`}>{count}</span>
            </button>
        );
    };

    return (
        <div className="h-full flex flex-col bg-base-100">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 border-b border-base-300">
                <UsedByHeading />
                <span className="text-sm text-base-content/60">
                    {plural(architectures.length, 'architecture')} in {plural(namespaces.length, 'namespace')}
                </span>
                <input
                    type="search"
                    aria-label="Filter architectures"
                    placeholder="Filter by name or namespace"
                    className="input input-sm input-bordered ml-auto w-full sm:w-72"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
                <select
                    aria-label="Show architectures in namespace"
                    className="select select-sm select-bordered m-3 lg:hidden"
                    value={selected ?? ''}
                    onChange={(e) => setSelected(e.target.value || null)}
                >
                    <option value="">All namespaces ({architectures.length})</option>
                    {namespaces.map(([namespace, count]) => (
                        <option key={namespace} value={namespace}>
                            {namespace} ({count})
                        </option>
                    ))}
                </select>
                <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r border-base-300 p-3 gap-1 overflow-y-auto">
                    <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">By namespace</div>
                    {namespaceButton(null, 'All namespaces', architectures.length)}
                    {namespaces.map(([namespace, count]) => namespaceButton(namespace, namespace, count))}
                </aside>
                <ul className="flex-1 min-w-0 overflow-auto divide-y divide-base-200 text-sm">
                    {shown.map((a) => (
                        <li key={a.key} className="px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <ExternalLink href={architectureHref(a.versions[a.versions.length - 1])} label={a.label} />
                            {selected === null && <span className="text-xs text-base-content/60">{a.namespace}</span>}
                            <span className="ml-auto inline-flex flex-wrap gap-1">
                                {a.versions.map((v) => (
                                    <a
                                        key={v.version}
                                        href={architectureHref(v)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="badge badge-sm badge-ghost font-mono hover:underline"
                                    >
                                        {v.version}
                                    </a>
                                ))}
                            </span>
                        </li>
                    ))}
                    {shown.length === 0 && <li className="px-6 py-4 text-base-content/60">No architectures match the filter.</li>}
                </ul>
            </div>
        </div>
    );
}
