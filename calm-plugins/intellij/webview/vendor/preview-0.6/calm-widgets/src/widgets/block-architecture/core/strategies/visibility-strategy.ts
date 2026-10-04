import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../types';

export interface VisibilityFilterResult {
    visibleNodes: Set<string>;
    activeRelationships?: CalmRelationshipCanonicalModel[];
    seedNodes?: Set<string>;
    warnings: string[];
}

export interface VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult;
}

/**
 * A chain of visibility filter strategies.
 * Strategies are applied in sequence, passing along the accumulated result.
 */
export class VisibilityFilterChain {
    private strategies: VisibilityFilterStrategy[] = [];

    addStrategy(strategy: VisibilityFilterStrategy): this {
        this.strategies.push(strategy);
        return this;
    }

    applyFilters(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        initialVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        let visibleNodes = new Set(initialVisible);
        let activeRelationships: CalmRelationshipCanonicalModel[] | undefined = relationships;
        let seedNodes: Set<string> | undefined;
        const warnings: string[] = [];

        for (const strategy of this.strategies) {
            const res = strategy.applyFilter(context, options, visibleNodes, activeRelationships ?? []);
            visibleNodes = res.visibleNodes;
            if (res.activeRelationships !== undefined) {
                activeRelationships = res.activeRelationships;
            }
            if (res.seedNodes !== undefined) {
                seedNodes = res.seedNodes;
            }
            warnings.push(...res.warnings);
        }

        return {
            visibleNodes,
            activeRelationships,
            seedNodes,
            warnings,
        };
    }

    /**
     * Expose strategies in order for testing/inspection.
     * Returns a shallow copy to keep the internal list immutable.
     */
    getStrategies(): ReadonlyArray<VisibilityFilterStrategy> {
        return [...this.strategies];
    }
}
