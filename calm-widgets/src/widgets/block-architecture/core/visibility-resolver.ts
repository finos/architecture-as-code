import {
    CalmCoreCanonicalModel,
    CalmNodeCanonicalModel,
    CalmRelationshipCanonicalModel,
    toKindView,
} from '@finos/calm-models/canonical';
import { NormalizedOptions, IncludeContainers } from '../types';
import { ParentHierarchyResult } from './relationship-analyzer';
import { VisibilityFilterChain } from './strategies/visibility-strategy';
import { FlowFocusStrategy } from './strategies/reduce/flow-focus-strategy';
import { NodeFocusStrategy } from './strategies/reduce/node-focus-strategy';
import { InterfaceFocusStrategy } from './strategies/reduce/interface-focus-strategy';
import { ControlFocusStrategy } from './strategies/reduce/control-focus-strategy';
import { RelationshipFocusStrategy } from './strategies/reduce/relationship-focus-strategy';
import { NodeTypeFilterStrategy } from './strategies/reduce/node-type-filter-strategy';
import { ChildrenStrategy } from './strategies/expand/children-strategy';
import { EdgeStrategy } from './strategies/expand/edge-strategy';
import { ContainerStrategy } from './strategies/expand/container-strategy';

export interface VisibilityResult {
    visibleNodes: Set<string>;
    filteredNodes: CalmNodeCanonicalModel[];
    filteredRels: CalmRelationshipCanonicalModel[];
    containerIds: Set<string>;
    warnings: string[];
}

/**
 * Determines which container IDs should be rendered based on the visibility policy.
 */
function collectContainerIdsForVisible(
    visible: Set<string>,
    parentOf: Map<string, string>,
    include: IncludeContainers,
    allMentioned: Set<string>
): Set<string> {
    if (include === 'none') return new Set();
    if (include === 'all') return new Set(allMentioned);

    // parents
    const wanted = new Set<string>();
    for (const nid of visible) {
        const p = parentOf.get(nid);
        if (p) wanted.add(p);
    }
    return wanted;
}

/**
 * Factory for the default strategy chain.
 */
export function buildDefaultFilterChain(
    nodesById: Map<string, CalmNodeCanonicalModel>,
    childrenOfContainer: Map<string, Set<string>>,
    allMentionedContainers: Set<string>
): VisibilityFilterChain {
    return new VisibilityFilterChain()
        // PHASE 1: FOCUS
        .addStrategy(new FlowFocusStrategy())
        .addStrategy(new NodeFocusStrategy())
        .addStrategy(new InterfaceFocusStrategy())
        .addStrategy(new ControlFocusStrategy())
        .addStrategy(new RelationshipFocusStrategy())
        .addStrategy(new NodeTypeFilterStrategy(nodesById))
        // PHASE 2: EXPANSION
        .addStrategy(new ChildrenStrategy(childrenOfContainer))
        .addStrategy(new EdgeStrategy())
        .addStrategy(new ContainerStrategy(allMentionedContainers));
}

/**
 * Compute which nodes, relationships and containers should be visible for rendering.
 *
 * This function is the central "visibility resolver" for the block-architecture widget.
 * Given a canonical model, normalized UI options, and pre-computed parent/child hierarchy
 * information, it performs a multi-stage visibility calculation using a chain of strategies.
 *
 * High-level behaviour:
 * 1. Determine an initial visible node set:
 *    - If any focus options are present (flows, nodes, interfaces, controls, relationships),
 *      start with an empty visible set and allow the focus strategies to add seed nodes.
 *    - Otherwise, start with all nodes visible.
 * 2. Build and run the default VisibilityFilterChain (focus → expand). Strategies
 *    may add seedNodes, set/override activeRelationships, and emit warnings.
 * 3. From the final visible node set, compute:
 *    - filteredNodes: the canonical node objects that are visible.
 *    - filteredRels: the canonical relationships to render, determined by the
 *      currently activeRelationships (if any) or all relationships otherwise. Relationship
 *      inclusion respects the opts.edges policy (none | seeded | connected) and the
 *      relationship kind (connects, interacts, composed-of, deployed-in).
 *    - containerIds: container IDs to render according to opts.includeContainers
 *      (none | parents of visible nodes | all mentioned containers).
 * 4. Aggregate warnings from the parentHierarchyResult and the filter chain and return a
 *    VisibilityResult describing the final visibleNodes, filteredNodes, filteredRels,
 *    containerIds and warnings.
 *
 * Notes:
 * - The function expects the canonical model shapes from '@finos/calm-models/canonical'
 *   and uses toKindView(...) to normalize relationship-type payloads before inspecting them.
 * - Strategies in the chain can affect the resulting visible nodes and which relationships
 *   are considered active; this design allows composition and testing of individual policies.
 *
 * Inputs:
 *  - context: CalmCoreCanonicalModel (nodes + relationships)
 *  - opts: NormalizedOptions (UI options that affect visibility/edges/containers)
 *  - parentHierarchyResult: parent/child mappings and warnings from earlier analysis
 *  - nodesById: map of node-id → CalmNodeCanonicalModel for quick lookup
 *
 * Output:
 *  - VisibilityResult with:
 *     - visibleNodes: Set<string> of node ids that should be shown
 *     - filteredNodes: array of canonical node objects to render
 *     - filteredRels: array of canonical relationship objects to render
 *     - containerIds: Set<string> of container ids to render
 *     - warnings: aggregated warnings encountered during resolution
 */
export function resolveVisibilityWithStrategies(
    context: CalmCoreCanonicalModel,
    opts: NormalizedOptions,
    parentHierarchyResult: ParentHierarchyResult,
    nodesById: Map<string, CalmNodeCanonicalModel>
): VisibilityResult {
    const { parentOf, allMentionedContainers, childrenOfContainer } = parentHierarchyResult;
    const nodes = context.nodes ?? [];
    const relationships = context.relationships ?? [];
    const allNodeIds = new Set(nodes.map(n => n['unique-id']));

    const hasFocusOptions = Boolean(
        opts.focusFlows?.length ||
        opts.focusNodes?.length ||
        opts.focusInterfaces?.length ||
        opts.focusControls?.length ||
        opts.focusRelationships?.length
    );

    const initialVisible = hasFocusOptions ? new Set<string>() : new Set(allNodeIds);

    const filterChain = buildDefaultFilterChain(nodesById, childrenOfContainer, allMentionedContainers);

    const result = filterChain.applyFilters(
        context,
        opts,
        initialVisible,
        relationships
    );

    const filteredNodes = nodes.filter(n => result.visibleNodes.has(n['unique-id']));
    const activeRelationships = result.activeRelationships || relationships;

    const filteredRels = activeRelationships.filter(r => {
        const relTypeWithKind = toKindView(r['relationship-type']);

        if (relTypeWithKind.kind === 'connects' || relTypeWithKind.kind === 'interacts') {
            if (opts.edges === 'none') return false;

            if (opts.edges === 'seeded') {
                if (relTypeWithKind.kind === 'connects') {
                    return result.visibleNodes.has(relTypeWithKind.source.node) &&
                        result.visibleNodes.has(relTypeWithKind.destination.node);
                }
                if (relTypeWithKind.kind === 'interacts') {
                    const actor = relTypeWithKind.actor;
                    const nodes = relTypeWithKind.nodes || [];
                    return result.visibleNodes.has(actor) &&
                        nodes.every((n: string) => result.visibleNodes.has(n));
                }
            }

            if (opts.edges === 'connected') {
                if (relTypeWithKind.kind === 'connects') {
                    return result.visibleNodes.has(relTypeWithKind.source.node) &&
                        result.visibleNodes.has(relTypeWithKind.destination.node);
                }
                if (relTypeWithKind.kind === 'interacts') {
                    const actor = relTypeWithKind.actor;
                    const nodes = relTypeWithKind.nodes || [];
                    return result.visibleNodes.has(actor) &&
                        nodes.some((n: string) => result.visibleNodes.has(n));
                }
            }

            return false;
        }

        if (relTypeWithKind.kind === 'composed-of' || relTypeWithKind.kind === 'deployed-in') {
            const container = relTypeWithKind.container;
            const nodes = relTypeWithKind.nodes || [];
            return result.visibleNodes.has(container) &&
                nodes.some(node => result.visibleNodes.has(node));
        }

        return false;
    });

    const containerIds = collectContainerIdsForVisible(
        result.visibleNodes,
        parentOf,
        opts.includeContainers,
        allMentionedContainers
    );

    return {
        visibleNodes: result.visibleNodes,
        filteredNodes,
        filteredRels,
        containerIds,
        warnings: [...parentHierarchyResult.warnings, ...result.warnings],
    };
}
