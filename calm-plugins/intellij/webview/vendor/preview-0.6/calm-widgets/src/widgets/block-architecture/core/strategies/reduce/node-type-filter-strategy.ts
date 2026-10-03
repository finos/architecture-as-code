import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel, CalmNodeCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that filters nodes by their node-type property.
 */
export class NodeTypeFilterStrategy implements VisibilityFilterStrategy {
    constructor(
        private nodesById: Map<string, CalmNodeCanonicalModel>
    ) {}

    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        _relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        let newVisible = currentVisible;

        if (options.nodeTypes?.length) {
            newVisible = this.applyNodeTypeFilter(currentVisible, options.nodeTypes, this.nodesById);
        }

        return {
            visibleNodes: newVisible,
            warnings: []
        };
    }

    /**
     * Filters the visible nodes to only include those matching the specified node types.
     * Returns a new set containing only nodes whose 'node-type' property matches one
     * of the provided type strings.
     */
    private applyNodeTypeFilter(
        visibleNodes: Set<string>,
        nodeTypes: string[],
        nodesById: Map<string, CalmNodeCanonicalModel>
    ): Set<string> {
        return new Set(
            [...visibleNodes].filter(id => {
                const n = nodesById.get(id);
                return n && nodeTypes.includes(n['node-type']);
            })
        );
    }
}
