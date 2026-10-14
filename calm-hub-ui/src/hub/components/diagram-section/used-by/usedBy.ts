import type { PatternImplementation } from '../../../../model/pattern-implementation.js';

export const USED_BY_LABEL = 'Used by';
export const USED_BY_TOOLTIP = 'Architectures that use this pattern version. Check them before you change the pattern.';

export function architectureHref(implementation: PatternImplementation): string {
    const id = implementation.customId ?? String(implementation.architectureId);
    return `#/${encodeURIComponent(implementation.namespace)}/architectures/${encodeURIComponent(id)}/${encodeURIComponent(implementation.version)}`;
}
