import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
    CalmControlCanonicalModel,
    toKindView,
    CalmControlsCanonicalModel
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that filters nodes and relationships based on control focus.
 * Special behavior: if a control is found on a flow, it pulls in all nodes and relationships from that flow.
 * Otherwise, it pulls in nodes and relationships that have the matching control.
 */
export class ControlFocusStrategy implements VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        if (!options.focusControls?.length) {
            return {
                visibleNodes: currentVisible,
                activeRelationships: relationships,
                warnings: []
            };
        }

        const result = this.processControlFocus(context, options.focusControls);

        // If we have control-related nodes, add them to current visible set
        const newVisible = new Set(currentVisible);
        if (result.controlNodes && result.controlNodes.size > 0) {
            const allNodeIds = new Set((context.nodes ?? []).map(n => n['unique-id']));
            for (const nodeId of result.controlNodes) {
                if (allNodeIds.has(nodeId)) {
                    newVisible.add(nodeId);
                }
            }
        }

        return {
            visibleNodes: newVisible,
            activeRelationships: result.activeRelationships,
            seedNodes: result.controlNodes,
            warnings: result.warnings
        };
    }

    /**
     * Processes control-based focusing with special flow handling.
     * If controls are found on flows, pulls in all nodes and relationships from those flows.
     * Otherwise, pulls in nodes and relationships that have the matching controls.
     */
    private processControlFocus(
        context: CalmCoreCanonicalModel,
        focusControls: string[]
    ): {
        activeRelationships: CalmRelationshipCanonicalModel[];
        controlNodes?: Set<string>;
        warnings: string[];
    } {
        const relationships = context.relationships ?? [];
        const flows = context.flows ?? [];
        const warnings: string[] = [];

        // First check if any flows have the matching controls
        const matchingFlows = [];
        for (const flow of flows) {
            if (flow.controls && this.hasMatchingControls(flow.controls, focusControls)) {
                matchingFlows.push(flow);
            }
        }

        // If we found flows with matching controls, use flow logic
        if (matchingFlows.length > 0) {
            const flowEdgeIds = new Set<string>();
            for (const flow of matchingFlows) {
                for (const transition of flow.transitions ?? []) {
                    if (transition['relationship-unique-id']) {
                        flowEdgeIds.add(transition['relationship-unique-id']);
                    }
                }
            }

            const activeRelationships = relationships.filter(r => flowEdgeIds.has(r['unique-id']));
            const controlNodes = new Set<string>();

            // Extract nodes from flow relationships
            for (const rel of activeRelationships) {
                const relTypeWithKind = toKindView(rel['relationship-type']);
                if (relTypeWithKind.kind === 'connects') {
                    controlNodes.add(relTypeWithKind.source.node);
                    controlNodes.add(relTypeWithKind.destination.node);
                } else if (relTypeWithKind.kind === 'interacts') {
                    controlNodes.add(relTypeWithKind.actor);
                    relTypeWithKind.nodes.forEach(node => controlNodes.add(node));
                }
            }

            return { activeRelationships, controlNodes, warnings };
        }

        // No matching flows, use standard control matching logic
        return this.processStandardControlFocus(context, focusControls);
    }

    private hasMatchingControls(
        controls: CalmControlsCanonicalModel,
        focusControls: string[]
    ): boolean {
        for (const criteria of focusControls) {
            for (const [controlId, control] of Object.entries<CalmControlCanonicalModel>(controls)) {
                if (this.matchesControl(controlId, control, criteria)) {
                    return true;
                }
            }
        }
        return false;
    }

    private processStandardControlFocus(
        context: CalmCoreCanonicalModel,
        focusControls: string[]
    ): {
        activeRelationships: CalmRelationshipCanonicalModel[];
        controlNodes?: Set<string>;
        warnings: string[];
    } {
        const relationships = context.relationships ?? [];
        const nodes = context.nodes ?? [];
        const warnings: string[] = [];

        // Collect all controls from context, nodes, and relationships
        const allControls = new Map<string, { control: CalmControlCanonicalModel; sources: Set<string> }>();

        // Add context-level controls
        if (context.controls) {
            for (const [controlId, control] of Object.entries(context.controls)) {
                if (!allControls.has(controlId)) {
                    allControls.set(controlId, { control, sources: new Set() });
                }
                allControls.get(controlId)!.sources.add('context');
            }
        }

        // Add node-level controls and track which nodes have them
        for (const node of nodes) {
            if (node.controls) {
                for (const [controlId, control] of Object.entries(node.controls)) {
                    if (!allControls.has(controlId)) {
                        allControls.set(controlId, { control, sources: new Set() });
                    }
                    allControls.get(controlId)!.sources.add(node['unique-id']);
                }
            }
        }

        // Add relationship-level controls
        for (const rel of relationships) {
            if (rel.controls) {
                for (const [controlId, control] of Object.entries(rel.controls)) {
                    if (!allControls.has(controlId)) {
                        allControls.set(controlId, { control, sources: new Set() });
                    }
                    allControls.get(controlId)!.sources.add(rel['unique-id']);
                }
            }
        }

        // Find matching controls using flexible property matching
        const matchingControlIds = new Set<string>();
        const matchingNodeIds = new Set<string>();
        const matchingRelationshipIds = new Set<string>();

        for (const criteria of focusControls) {
            let foundMatch = false;

            for (const [controlId, { control, sources }] of allControls) {
                if (this.matchesControl(controlId, control, criteria)) {
                    matchingControlIds.add(controlId);
                    foundMatch = true;

                    // Collect nodes and relationships that use this control
                    for (const source of sources) {
                        if (source === 'context') continue;

                        // Check if it's a node ID
                        const node = nodes.find(n => n['unique-id'] === source);
                        if (node) {
                            matchingNodeIds.add(node['unique-id']);
                        } else {
                            // Must be a relationship ID
                            matchingRelationshipIds.add(source);
                        }
                    }
                }
            }

            if (!foundMatch) {
                warnings.push(`No controls matched criteria: "${criteria}"`);
            }
        }

        if (matchingControlIds.size === 0) {
            return { activeRelationships: relationships, warnings };
        }

        // Filter relationships to include those with matching controls or those that are matched
        const activeRelationships = relationships.filter(rel => {
            // Include if the relationship itself has matching controls
            if (matchingRelationshipIds.has(rel['unique-id'])) {
                return true;
            }

            // Include if it connects to nodes that have matching controls
            const relType = rel['relationship-type'];
            if ('connects' in relType) {
                const connects = relType.connects;
                return matchingNodeIds.has(connects.source.node) ||
                       matchingNodeIds.has(connects.destination.node);
            } else if ('interacts' in relType) {
                const interacts = relType.interacts;
                if (matchingNodeIds.has(interacts.actor)) return true;
                return interacts.nodes.some(nodeId => matchingNodeIds.has(nodeId));
            }

            return false;
        });

        // Extract nodes from relationships that have matching controls
        const allMatchingNodeIds = new Set(matchingNodeIds);
        for (const relId of matchingRelationshipIds) {
            const rel = relationships.find(r => r['unique-id'] === relId);
            if (rel) {
                const relTypeWithKind = toKindView(rel['relationship-type']);
                if (relTypeWithKind.kind === 'connects') {
                    allMatchingNodeIds.add(relTypeWithKind.source.node);
                    allMatchingNodeIds.add(relTypeWithKind.destination.node);
                } else if (relTypeWithKind.kind === 'interacts') {
                    allMatchingNodeIds.add(relTypeWithKind.actor);
                    relTypeWithKind.nodes.forEach(node => allMatchingNodeIds.add(node));
                } else if (relTypeWithKind.kind === 'deployed-in' || relTypeWithKind.kind === 'composed-of') {
                    allMatchingNodeIds.add(relTypeWithKind.container);
                    relTypeWithKind.nodes.forEach(node => allMatchingNodeIds.add(node));
                }
            }
        }

        return {
            activeRelationships,
            controlNodes: allMatchingNodeIds,
            warnings
        };
    }

    /**
     * Control matching with priority for exact matches over text search.
     * 1. First tries exact control ID match (case-sensitive and case-insensitive)
     * 2. Only falls back to text search if no exact match found
     */
    private matchesControl(controlId: string, control: CalmControlCanonicalModel, criteria: string): boolean {
        const criteriaLower = criteria.toLowerCase().trim();

        // PRIORITY 1: Exact match on control ID (case-sensitive)
        if (controlId === criteria) {
            return true;
        }

        // PRIORITY 2: Case-insensitive exact match on control ID
        if (controlId.toLowerCase() === criteriaLower) {
            return true;
        }

        // PRIORITY 3: Only do text search if criteria looks like a search term (not a control ID)
        // Skip text search for things that look like control IDs (kebab-case, no spaces)
        const looksLikeControlId = /^[a-z0-9-]+$/i.test(criteria) && !criteria.includes(' ');
        if (looksLikeControlId) {
            // For control-ID-like criteria, don't do fuzzy text matching
            return false;
        }

        // FALLBACK: Text search for non-control-ID-like criteria (e.g., "GDPR", "OAuth2")
        return this.performTextSearch(control, criteriaLower);
    }

    /**
     * Performs text search across control properties for non-control-ID criteria.
     */
    private performTextSearch(control: CalmControlCanonicalModel, criteriaLower: string): boolean {
        // Check control description
        if (control.description && control.description.toLowerCase().includes(criteriaLower)) {
            return true;
        }

        // Check requirements
        if (control.requirements) {
            for (const req of control.requirements) {
                // Check requirement-url
                if (req['requirement-url'] && req['requirement-url'].toLowerCase().includes(criteriaLower)) {
                    return true;
                }

                // Check other properties in requirements
                for (const [key, value] of Object.entries(req)) {
                    if (key === 'requirement-url') continue;

                    if (typeof value === 'string' && value.toLowerCase().includes(criteriaLower)) {
                        return true;
                    }

                    if (value != null && typeof value !== 'object') {
                        if (String(value).toLowerCase().includes(criteriaLower)) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }
}
