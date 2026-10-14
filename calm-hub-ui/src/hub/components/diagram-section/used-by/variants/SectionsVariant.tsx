import { useMemo, useState } from 'react';
import { IoChevronDownOutline, IoChevronForwardOutline } from 'react-icons/io5';
import type { PatternImplementation } from '../../../../../model/pattern-implementation.js';
import { ArchitectureLink, FilterInput, groupByArchitecture, matchesFilter, summary, type ArchitectureGroup } from './shared.js';
import { architectureHref } from '../usedBy.js';

/** D: one collapsible section per namespace. Each section is a dense multi-column list. */
export function SectionsVariant({ rows }: { rows: PatternImplementation[] }) {
    const groups = useMemo(() => groupByArchitecture(rows), [rows]);
    const [term, setTerm] = useState('');
    const [closed, setClosed] = useState<Set<string>>(new Set());
    const byNamespace = useMemo(() => {
        const map = new Map<string, ArchitectureGroup[]>();
        groups.filter((g) => matchesFilter(g, term)).forEach((g) => map.set(g.namespace, [...(map.get(g.namespace) ?? []), g]));
        return [...map.entries()];
    }, [groups, term]);
    const s = summary(groups);
    const toggle = (ns: string) =>
        setClosed((prev) => {
            const next = new Set(prev);
            if (next.has(ns)) next.delete(ns);
            else next.add(ns);
            return next;
        });

    return (
        <div className="h-full overflow-auto bg-base-100 p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="text-sm text-base-content/70">
                    <span className="font-semibold text-base-content">{s.architectures} architectures</span> in {s.namespaces} namespaces
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => setClosed(new Set())}>
                    Expand all
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => setClosed(new Set(byNamespace.map(([ns]) => ns)))}>
                    Collapse all
                </button>
                <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
            </div>
            {byNamespace.map(([ns, list]) => {
                const open = !closed.has(ns);
                return (
                    <section key={ns} className="mb-3 rounded-box border border-base-300">
                        <button onClick={() => toggle(ns)} className="w-full flex items-center gap-2 px-4 py-2 bg-base-200 rounded-t-box text-left">
                            {open ? <IoChevronDownOutline /> : <IoChevronForwardOutline />}
                            <span className="font-semibold">{ns}</span>
                            <span className="badge badge-sm badge-ghost">{list.length}</span>
                        </button>
                        {open && (
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-6 gap-y-1 px-4 py-3">
                                {list.map((g) => (
                                    <li key={g.architectureId} className="flex items-baseline gap-2 min-w-0">
                                        <ArchitectureLink group={g} />
                                        <span className="text-xs text-base-content/60 font-mono truncate">
                                            {g.versions.map((v, i) => (
                                                <span key={v.version}>
                                                    {i > 0 && ', '}
                                                    <a href={architectureHref(v)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {v.version}
                                                    </a>
                                                </span>
                                            ))}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
