import { useMemo, useState } from 'react';
import { IoGitNetworkOutline } from 'react-icons/io5';
import type { PatternImplementation } from '../../../../../model/pattern-implementation.js';
import { ArchitectureLink, FilterInput, VersionChips, groupByArchitecture, groupLabel, matchesFilter, summary } from './shared.js';

/** B: the architectures that use this pattern version, filtered by namespace on the left. */
export function NamespacesVariant({ rows }: { rows: PatternImplementation[] }) {
    const groups = useMemo(
        () => groupByArchitecture(rows).sort((a, b) => groupLabel(a).localeCompare(groupLabel(b)) || a.namespace.localeCompare(b.namespace)),
        [rows]
    );
    const namespaces = useMemo(() => {
        const counts = new Map<string, number>();
        groups.forEach((g) => counts.set(g.namespace, (counts.get(g.namespace) ?? 0) + 1));
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }, [groups]);
    const [selected, setSelected] = useState<string | null>(null);
    const [term, setTerm] = useState('');
    const shown = groups.filter((g) => (selected === null || g.namespace === selected) && matchesFilter(g, term));
    const s = summary(groups);

    const item = (key: string | null, label: string, count: number) => {
        const active = selected === key;
        return (
            <button
                key={label}
                onClick={() => setSelected(key)}
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
                <div className="flex items-center gap-2 font-semibold">
                    <IoGitNetworkOutline className="text-[var(--color-interaction)] shrink-0" />
                    Architectures that use this pattern version
                </div>
                <div className="text-sm text-base-content/60">
                    {s.architectures} in {s.namespaces} namespaces
                </div>
                <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
            </div>
            <div className="flex-1 min-h-0 flex flex-col md:flex-row">
                <select
                    aria-label="Show architectures in namespace"
                    className="select select-sm select-bordered m-3 md:hidden"
                    value={selected ?? ''}
                    onChange={(e) => setSelected(e.target.value || null)}
                >
                    <option value="">All namespaces ({s.architectures})</option>
                    {namespaces.map(([ns, count]) => (
                        <option key={ns} value={ns}>
                            {ns} ({count})
                        </option>
                    ))}
                </select>
                <aside className="hidden md:flex md:flex-col md:w-64 md:border-r border-base-300 p-3 gap-1 overflow-y-auto">
                    <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">By namespace</div>
                    {item(null, 'All namespaces', s.architectures)}
                    {namespaces.map(([ns, count]) => item(ns, ns, count))}
                </aside>
                <ul className="flex-1 min-w-0 overflow-auto divide-y divide-base-200">
                    {shown.map((g) => (
                        <li key={`${g.namespace}/${g.architectureId}`} className="px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <ArchitectureLink group={g} />
                            {selected === null && <span className="text-xs text-base-content/60">{g.namespace}</span>}
                            <span className="ml-auto">
                                <VersionChips group={g} />
                            </span>
                        </li>
                    ))}
                    {shown.length === 0 && <li className="px-6 py-4 text-base-content/60">No architectures match the filter.</li>}
                </ul>
            </div>
        </div>
    );
}
