import { FiExternalLink } from 'react-icons/fi';
import { THEME } from '../../../../../visualizer/components/reactflow/theme.js';
import type { PatternImplementation } from '../../../../../model/pattern-implementation.js';
import { architectureHref } from '../usedBy.js';

export interface ArchitectureGroup {
    namespace: string;
    architectureId: number;
    customId?: string;
    versions: PatternImplementation[];
}

export function groupByArchitecture(rows: PatternImplementation[]): ArchitectureGroup[] {
    const groups = new Map<string, ArchitectureGroup>();
    for (const row of rows) {
        const key = `${row.namespace}/${row.architectureId}`;
        const group = groups.get(key) ?? { namespace: row.namespace, architectureId: row.architectureId, customId: row.customId, versions: [] };
        group.versions.push(row);
        groups.set(key, group);
    }
    return [...groups.values()];
}

export function groupLabel(group: ArchitectureGroup): string {
    return group.customId ?? `Architecture ${group.architectureId}`;
}

export function matchesFilter(group: ArchitectureGroup, term: string): boolean {
    const t = term.trim().toLowerCase();
    return t === '' || groupLabel(group).toLowerCase().includes(t) || group.namespace.toLowerCase().includes(t);
}

export const linkStyle = { color: THEME.colors.accentText };

export function ArchitectureLink({ group }: { group: ArchitectureGroup }) {
    const latest = group.versions[group.versions.length - 1];
    return (
        <a href={architectureHref(latest)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline font-medium text-sm" style={linkStyle}>
            {groupLabel(group)}
            <FiExternalLink className="shrink-0" size={12} aria-hidden="true" />
        </a>
    );
}

export function VersionChips({ group }: { group: ArchitectureGroup }) {
    return (
        <span className="inline-flex flex-wrap gap-1">
            {group.versions.map((v) => (
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
    );
}

export function FilterInput({ value, onChange, className = '' }: { value: string; onChange: (v: string) => void; className?: string }) {
    return (
        <input
            type="search"
            aria-label="Filter architectures"
            placeholder="Filter by name or namespace"
            className={`input input-sm input-bordered ${className}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

export function summary(groups: ArchitectureGroup[]) {
    const namespaces = new Set(groups.map((g) => g.namespace)).size;
    const versions = groups.reduce((n, g) => n + g.versions.length, 0);
    return { architectures: groups.length, namespaces, versions };
}
