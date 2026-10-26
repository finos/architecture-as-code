import type { PatternImplementation } from '../../../../model/pattern-implementation.js';
import type { ImplementationsState } from './usePatternImplementations.js';

export const USED_BY_LABEL = 'Used by';
export const USED_BY_TOOLTIP = 'Architectures that use this pattern version. Check them before you change the pattern.';

/** One architecture, with each of its versions that uses the pattern version, oldest first. */
export interface UsingArchitecture {
    key: string;
    namespace: string;
    label: string;
    versions: PatternImplementation[];
}

const architectureKey = (row: PatternImplementation) => `${row.namespace}/${row.architectureId}`;

/** Counts architectures, not their versions. The count shows only once the tab has loaded the list. */
export function usedByLabel(state: ImplementationsState): string {
    if (state.status !== 'loaded') return USED_BY_LABEL;
    return `${USED_BY_LABEL} (${new Set(state.implementations.map(architectureKey)).size})`;
}

/** Sorted by name, then namespace. The hub returns the versions of each architecture oldest first. */
export function groupByArchitecture(rows: PatternImplementation[]): UsingArchitecture[] {
    const groups = new Map<string, UsingArchitecture>();
    for (const row of rows) {
        const key = architectureKey(row);
        const group = groups.get(key) ?? {
            key,
            namespace: row.namespace,
            label: row.customId ?? `Architecture ${row.architectureId}`,
            versions: [],
        };
        group.versions.push(row);
        groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label) || a.namespace.localeCompare(b.namespace));
}

/** Namespaces with the most architectures first. */
export function countByNamespace(architectures: UsingArchitecture[]): [string, number][] {
    const counts = new Map<string, number>();
    architectures.forEach((a) => counts.set(a.namespace, (counts.get(a.namespace) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function plural(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function architectureHref(implementation: PatternImplementation): string {
    const id = implementation.customId ?? String(implementation.architectureId);
    return `#/${encodeURIComponent(implementation.namespace)}/architectures/${encodeURIComponent(id)}/${encodeURIComponent(implementation.version)}`;
}
