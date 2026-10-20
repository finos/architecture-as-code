import type { PatternImplementation } from '../../../../model/pattern-implementation.js';
import type { ImplementationsState } from './usePatternImplementations.js';

export const USED_BY_LABEL = 'Used by';
export const USED_BY_TOOLTIP = 'Architectures that use this pattern version. Check them before you change the pattern.';

/** Counts architectures, not their versions. The count shows only once the tab has loaded the list. */
export function usedByLabel(state: ImplementationsState): string {
    if (state.status !== 'loaded') return USED_BY_LABEL;
    const architectures = new Set(state.implementations.map((i) => `${i.namespace}/${i.architectureId}`));
    return `${USED_BY_LABEL} (${architectures.size})`;
}

export function architectureHref(implementation: PatternImplementation): string {
    const id = implementation.customId ?? String(implementation.architectureId);
    return `#/${encodeURIComponent(implementation.namespace)}/architectures/${encodeURIComponent(id)}/${encodeURIComponent(implementation.version)}`;
}
