import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';


/**
 * Strategy that seeds the visible nodes based on focus-nodes parameter.
 * When focus-nodes is specified, it includes only the specified nodes (no relationships expansion).
 */
export class NodeFocusStrategy implements VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        opts: NormalizedOptions,
        currentVisible: Set<string>,
        _relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        // If no focus-nodes specified, pass through unchanged
        if (!opts.focusNodes || opts.focusNodes.length === 0) {
            return {
                visibleNodes: currentVisible,
                warnings: []
            };
        }

        const allNodeIds = new Set((context.nodes ?? []).map(n => n['unique-id']));
        const focusNodeIds = new Set(opts.focusNodes);

        const validFocusNodes = new Set([...focusNodeIds].filter(id => allNodeIds.has(id)));
        const newVisibleNodes = new Set([...currentVisible, ...validFocusNodes]);

        const warnings: string[] = [];
        const invalidNodes = [...focusNodeIds].filter(id => !allNodeIds.has(id));
        if (invalidNodes.length > 0) {
            warnings.push(`Focus nodes not found: ${invalidNodes.join(', ')}`);
        }

        return {
            visibleNodes: newVisibleNodes,
            seedNodes: validFocusNodes,
            warnings
        };
    }
}

