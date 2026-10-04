import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that handles container visibility rules.
 * Removes container nodes when include-containers is 'none' unless explicitly focused.
 */
export class ContainerStrategy implements VisibilityFilterStrategy {
    constructor(private allMentionedContainers: Set<string>) {}

    applyFilter(
        _context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        _relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        if (options.includeContainers !== 'none') {
            return { visibleNodes: currentVisible, warnings: [] };
        }

        const focus = new Set(options.focusNodes ?? []);
        const next = new Set(currentVisible);

        for (const cid of this.allMentionedContainers) {
            // Remove only if it's visible AND not explicitly focused
            if (!focus.has(cid)) next.delete(cid);
        }

        return { visibleNodes: next, warnings: [] };
    }
}
