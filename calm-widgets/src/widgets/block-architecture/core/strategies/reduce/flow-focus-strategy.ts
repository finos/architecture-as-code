import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel, CalmFlowCanonicalModel, toKindView, CalmRelationshipTypeKindView } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

export interface FlowProcessResult {
    activeRelationships: CalmRelationshipCanonicalModel[];
    flowSeedNodes?: Set<string>;
    warnings: string[];
}

/**
 * Strategy that filters relationships and extracts seed nodes based on flow focus.
 * This is the first strategy in the chain as it can significantly reduce the scope.
 */
export class FlowFocusStrategy implements VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        if (!options.focusFlows?.length) {
            return {
                visibleNodes: currentVisible,
                activeRelationships: relationships,
                warnings: []
            };
        }

        const flowResult = this.processFlowFocus(context, options.focusFlows);

        // Add flow nodes to current visible set (additive behavior)
        const newVisible = new Set(currentVisible);
        if (flowResult.flowSeedNodes && flowResult.flowSeedNodes.size > 0) {
            const allNodeIds = new Set((context.nodes ?? []).map(n => n['unique-id']));
            for (const nodeId of flowResult.flowSeedNodes) {
                if (allNodeIds.has(nodeId)) {
                    newVisible.add(nodeId);
                }
            }
        }

        return {
            visibleNodes: newVisible,
            activeRelationships: flowResult.activeRelationships,
            seedNodes: flowResult.flowSeedNodes,
            warnings: flowResult.warnings
        };
    }

    /**
     * Processes flow-based focusing by filtering relationships to only those used in
     * the specified flows. Matches flows by ID or name (case-insensitive) and extracts
     * the relationship IDs from flow transitions. Returns the filtered relationships
     * and the seed nodes involved in those flows.
     */
    private processFlowFocus(
        context: CalmCoreCanonicalModel,
        focusFlows: string[]
    ): FlowProcessResult {
        const relationships = context.relationships ?? [];
        const flows: CalmFlowCanonicalModel[] = context.flows ?? [];
        const warnings: string[] = [];

        const wanted = new Set(focusFlows.map(s => s.trim().toLowerCase()));
        const picked = flows.filter(f =>
            wanted.has(f['unique-id'].toLowerCase()) || wanted.has((f.name ?? '').toLowerCase())
        );

        if (picked.length === 0) {
            warnings.push(`No flows matched: ${Array.from(wanted).join(', ')}`);
            return { activeRelationships: relationships, warnings };
        }

        const flowEdgeIds = new Set<string>();
        for (const f of picked) {
            for (const t of f.transitions ?? []) {
                if (t['relationship-unique-id']) flowEdgeIds.add(t['relationship-unique-id']);
            }
        }

        const activeRelationships = relationships.filter(r => flowEdgeIds.has(r['unique-id']));

        const flowSeedNodes = new Set<string>();
        for (const r of activeRelationships) {
            const k = toKindView(r['relationship-type']);
            if (k.kind === 'connects') {
                const connectsRel = k as Extract<CalmRelationshipTypeKindView, { kind: 'connects' }>;
                flowSeedNodes.add(connectsRel.source.node);
                flowSeedNodes.add(connectsRel.destination.node);
            } else if (k.kind === 'interacts') {
                const interactsRel = k as Extract<CalmRelationshipTypeKindView, { kind: 'interacts' }>;
                flowSeedNodes.add(interactsRel.actor);
                for (const n of interactsRel.nodes ?? []) flowSeedNodes.add(n);
            }
        }

        return { activeRelationships, flowSeedNodes, warnings };
    }
}
