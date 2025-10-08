import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel, toKindView } from '@finos/calm-models/canonical';
import { NormalizedOptions, Direction } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that expands visibility to include nodes connected to currently visible nodes.
 * This is an expansion strategy that runs after focus and filtering strategies.
 */
export class EdgeStrategy implements VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        let newVisible = new Set(currentVisible);

        // Only expand when edges="connected" (not "seeded" or "none")
        if (options.edges === 'connected' && currentVisible.size > 0) {
            newVisible = this.expandWithConnectedNeighbors(currentVisible, relationships, options.direction);
        }

        return {
            visibleNodes: newVisible,
            warnings: []
        };
    }

    /**
     * Expands the visible set to include nodes connected to currently visible nodes.
     * Only handles 'connects' and 'interacts' relationships - composed-of and deployed-in
     * are handled by container logic instead.
     * Respects the direction parameter (NormalizedOptions.direction: 'both' | 'in' | 'out')
     * to control which neighbors to include. 'out' means include edges from source->destination
     * (i.e. visible source pulls in destination). 'in' means include destination->source (i.e.
     * visible destination pulls in source). 'both' includes both directions.
     */
    private expandWithConnectedNeighbors(
        currentVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[],
        direction: Direction | undefined = 'both'
    ): Set<string> {
        const expanded = new Set(currentVisible);

        const includeSourceToDest = (direction ?? 'both') === 'both' || (direction ?? 'both') === 'out';
        const includeDestToSource = (direction ?? 'both') === 'both' || (direction ?? 'both') === 'in';

        for (const rel of relationships) {
            const relTypeWithKind = toKindView(rel['relationship-type']);

            if (relTypeWithKind.kind === 'connects') {
                const sourceNode = relTypeWithKind.source.node;
                const destNode = relTypeWithKind.destination.node;

                // Add neighbors based on mapped direction semantics
                if (includeSourceToDest) {
                    if (currentVisible.has(sourceNode)) expanded.add(destNode);
                }
                if (includeDestToSource) {
                    if (currentVisible.has(destNode)) expanded.add(sourceNode);
                }
            } else if (relTypeWithKind.kind === 'interacts') {
                const actor = relTypeWithKind.actor;
                const nodes = relTypeWithKind.nodes || [];

                // Add all participants if any are visible
                // For interacts, we treat any visibility as bidirectional inclusion
                if (currentVisible.has(actor)) nodes.forEach(node => expanded.add(node));
                for (const node of nodes) {
                    if (currentVisible.has(node)) {
                        expanded.add(actor);
                        nodes.forEach(otherNode => expanded.add(otherNode));
                        break;
                    }
                }
            }
            // Note: composed-of and deployed-in relationships are NOT handled here
            // They are handled by the ContainerFilterStrategy based on include-containers setting
        }

        return expanded;
    }
}
