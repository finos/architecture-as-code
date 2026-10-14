import { useMemo, useState } from 'react';
import type { PatternImplementation } from '../../../../../model/pattern-implementation.js';
import { ArchitectureLink, FilterInput, VersionChips, groupByArchitecture, matchesFilter, summary } from './shared.js';

/** C: three summary tiles, then a responsive grid of architecture cards. */
export function CardsVariant({ rows }: { rows: PatternImplementation[] }) {
    const groups = useMemo(() => groupByArchitecture(rows), [rows]);
    const [term, setTerm] = useState('');
    const shown = groups.filter((g) => matchesFilter(g, term));
    const s = summary(groups);
    const tile = (label: string, value: number) => (
        <div className="rounded-box bg-base-200 px-4 py-3 min-w-28">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-xs uppercase tracking-wide text-base-content/60">{label}</div>
        </div>
    );
    return (
        <div className="h-full overflow-auto bg-base-100 p-6">
            <div className="flex flex-wrap items-end gap-3 mb-4">
                {tile('Architectures', s.architectures)}
                {tile('Namespaces', s.namespaces)}
                {tile('Versions', s.versions)}
                <FilterInput value={term} onChange={setTerm} className="ml-auto w-full sm:w-72" />
            </div>
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
                {shown.map((g) => (
                    <div key={`${g.namespace}/${g.architectureId}`} className="rounded-box border border-base-300 p-3 flex flex-col gap-2">
                        <ArchitectureLink group={g} />
                        <div className="text-xs text-base-content/60 truncate">{g.namespace}</div>
                        <VersionChips group={g} />
                    </div>
                ))}
            </div>
        </div>
    );
}
