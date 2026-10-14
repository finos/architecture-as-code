import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PatternImplementation } from '../../../../../model/pattern-implementation.js';
import { ArchitectureLink, FilterInput, VersionChips, groupByArchitecture, matchesFilter, summary } from './shared.js';

/** A: one dense, full-width table. The header stays pinned while the rows scroll. */
export function TableVariant({ rows }: { rows: PatternImplementation[] }) {
    const groups = useMemo(() => groupByArchitecture(rows), [rows]);
    const [term, setTerm] = useState('');
    const shown = groups.filter((g) => matchesFilter(g, term));
    const s = summary(groups);
    const [searchParams] = useSearchParams();
    const header = searchParams.get('header');
    const count = (n: number) => <span className="ml-1.5 font-normal text-base-content/50">{n}</span>;
    const pill = (n: number, label: string) => (
        <span className="badge badge-ghost gap-1">
            <span className="font-semibold">{n}</span> {label}
        </span>
    );
    return (
        <div className="h-full flex flex-col bg-base-100">
            {header === 'columns' ? (
                <div className="flex items-center px-6 py-2 border-b border-base-300">
                    <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
                </div>
            ) : header === 'pills' ? (
                <div className="flex flex-wrap items-center gap-2 px-6 py-2 border-b border-base-300">
                    {pill(s.architectures, 'architectures')}
                    {pill(s.namespaces, 'namespaces')}
                    {pill(s.versions, 'versions')}
                    <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
                </div>
            ) : header === 'sentence' ? (
                <div className="flex flex-wrap items-center gap-3 px-6 py-2 border-b border-base-300">
                    <span className="text-sm text-base-content/70">
                        <span className="font-semibold text-base-content">{s.architectures} architectures</span> in {s.namespaces} namespaces
                    </span>
                    <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-base-300">
                    <div>
                        <div className="font-semibold">{s.architectures} architectures use this version</div>
                        <div className="text-sm text-base-content/60">
                            {s.versions} architecture versions in {s.namespaces} namespaces
                        </div>
                    </div>
                    <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
                </div>
            )}
            <div className="flex-1 overflow-auto">
                <table className="table table-sm table-pin-rows">
                    <thead>
                        <tr>
                            <th>Architecture{header === 'columns' && count(s.architectures)}</th>
                            <th className="hidden md:table-cell">Namespace{header === 'columns' && count(s.namespaces)}</th>
                            <th>{header === 'columns' ? <>Versions{count(s.versions)}</> : 'Versions that name this pattern'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shown.map((g) => (
                            <tr key={`${g.namespace}/${g.architectureId}`} className="hover:bg-base-200">
                                <td>
                                    <ArchitectureLink group={g} />
                                    <div className="md:hidden text-xs text-base-content/60">{g.namespace}</div>
                                </td>
                                <td className="hidden md:table-cell text-base-content/70">{g.namespace}</td>
                                <td>
                                    <VersionChips group={g} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {shown.length === 0 && <p className="p-6 text-base-content/60">No architectures match the filter.</p>}
            </div>
        </div>
    );
}
