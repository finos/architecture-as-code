import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
    toKindView
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that seeds the visible nodes based on relationships that match the focus criteria.
 * When focus-relationships is specified, it finds relationships that match the given unique-ids
 * and includes all nodes that participate in those relationships.
 */
export class RelationshipFocusStrategy implements VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        opts: NormalizedOptions,
        currentVisible: Set<string>,
        _relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        // If no focus-relationships specified, pass through unchanged
        if (!opts.focusRelationships || opts.focusRelationships.length === 0) {
            return {
                visibleNodes: currentVisible,
                warnings: []
            };
        }

        const focusRelIds = new Set(opts.focusRelationships);
        const matchingRels: CalmRelationshipCanonicalModel[] = [];
        const participatingNodes = new Set<string>();

        for (const rel of context.relationships ?? []) {
            if (focusRelIds.has(rel['unique-id'])) {
                matchingRels.push(rel);

                const relTypeWithKind = toKindView(rel['relationship-type']);

                switch (relTypeWithKind.kind) {
                case 'connects':
                    participatingNodes.add(relTypeWithKind.source.node);
                    participatingNodes.add(relTypeWithKind.destination.node);
                    break;
                case 'interacts':
                    participatingNodes.add(relTypeWithKind.actor);
                    relTypeWithKind.nodes.forEach(node => participatingNodes.add(node));
                    break;
                case 'deployed-in':
                    participatingNodes.add(relTypeWithKind.container);
                    relTypeWithKind.nodes.forEach(node => participatingNodes.add(node));
                    break;
                case 'composed-of':
                    participatingNodes.add(relTypeWithKind.container);
                    relTypeWithKind.nodes.forEach(node => participatingNodes.add(node));
                    break;
                }
            }
        }

        // Add participating nodes to visible set
        const newVisibleNodes = new Set([...currentVisible, ...participatingNodes]);

        return {
            visibleNodes: newVisibleNodes,
            activeRelationships: matchingRels.length > 0 ? matchingRels : undefined,
            seedNodes: participatingNodes,
            warnings: matchingRels.length === 0
                ? [`No relationships found matching focus-relationships: ${opts.focusRelationships.join(', ')}`]
                : []
        };
    }
}
