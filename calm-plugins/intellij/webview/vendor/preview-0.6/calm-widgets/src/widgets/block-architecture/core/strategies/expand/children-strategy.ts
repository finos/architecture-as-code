import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that expands visibility to include children of focused container nodes.
 */
export class ChildrenStrategy implements VisibilityFilterStrategy {
    constructor(
        private childrenOfContainer: Map<string, Set<string>>
    ) {}

    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        _relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        const newVisible = new Set(currentVisible);

        if (options.includeChildren !== 'none' && options.focusNodes?.length) {
            const focusAsContainers = new Set(
                options.focusNodes.filter(id => this.childrenOfContainer.has(id))
            );

            if (focusAsContainers.size > 0) {
                const descendants = this.collectDescendants(
                    focusAsContainers,
                    this.childrenOfContainer,
                    options.includeChildren
                );
                for (const d of descendants) {
                    newVisible.add(d);
                }
            }
        }

        return {
            visibleNodes: newVisible,
            warnings: []
        };
    }

    /**
     * Collects all descendant nodes of the given root containers.
     * In 'direct' mode, only immediate children are collected.
     * In 'all' mode, recursively collects all descendants at any depth.
     */
    private collectDescendants(
        roots: Set<string>,
        childrenOfContainer: Map<string, Set<string>>,
        mode: 'direct' | 'all'
    ): Set<string> {
        const out = new Set<string>();
        const stack: string[] = [];

        for (const r of roots) {
            const kids = childrenOfContainer.get(r);
            if (!kids) continue;
            for (const k of kids) {
                out.add(k);
                if (mode === 'all') stack.push(k);
            }
        }

        if (mode === 'all') {
            while (stack.length) {
                const id = stack.pop()!;
                const kids = childrenOfContainer.get(id);
                if (!kids) continue;
                for (const k of kids) {
                    if (!out.has(k)) {
                        out.add(k);
                        stack.push(k);
                    }
                }
            }
        }

        return out;
    }
}
