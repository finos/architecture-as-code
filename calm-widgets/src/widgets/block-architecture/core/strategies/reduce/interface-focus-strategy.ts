import { CalmCoreCanonicalModel, CalmRelationshipCanonicalModel, CalmInterfaceCanonicalModel } from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { VisibilityFilterStrategy, VisibilityFilterResult } from '../visibility-strategy';

/**
 * Strategy that filters nodes and relationships based on interface focus.
 * Matches interfaces using flexible property matching and finds related nodes and relationships.
 */
export class InterfaceFocusStrategy implements VisibilityFilterStrategy {
    applyFilter(
        context: CalmCoreCanonicalModel,
        options: NormalizedOptions,
        currentVisible: Set<string>,
        relationships: CalmRelationshipCanonicalModel[]
    ): VisibilityFilterResult {
        if (!options.focusInterfaces?.length) {
            return {
                visibleNodes: currentVisible,
                activeRelationships: relationships,
                warnings: []
            };
        }

        const result = this.processInterfaceFocus(context, options.focusInterfaces);

        // Add interface nodes to current visible set (additive behavior)
        const newVisible = new Set(currentVisible);
        if (result.interfaceNodes && result.interfaceNodes.size > 0) {
            const allNodeIds = new Set((context.nodes ?? []).map(n => n['unique-id']));
            for (const nodeId of result.interfaceNodes) {
                if (allNodeIds.has(nodeId)) {
                    newVisible.add(nodeId);
                }
            }
        }

        return {
            visibleNodes: newVisible,
            activeRelationships: result.activeRelationships,
            seedNodes: result.interfaceNodes,
            warnings: result.warnings
        };
    }

    /**
     * Processes interface-based focusing by finding interfaces that match the criteria
     * and then collecting all nodes that use those interfaces, plus relationships
     * that connect to those interfaces.
     */
    private processInterfaceFocus(
        context: CalmCoreCanonicalModel,
        focusInterfaces: string[]
    ): {
        activeRelationships: CalmRelationshipCanonicalModel[];
        interfaceNodes?: Set<string>;
        warnings: string[];
    } {
        const relationships = context.relationships ?? [];
        const nodes = context.nodes ?? [];
        const warnings: string[] = [];

        // Collect all interfaces from all nodes
        const allInterfaces = new Map<string, { interface: CalmInterfaceCanonicalModel; nodeId: string }>();
        for (const node of nodes) {
            if (node.interfaces) {
                for (const iface of node.interfaces) {
                    allInterfaces.set(iface['unique-id'], { interface: iface, nodeId: node['unique-id'] });
                }
            }
        }

        // Find matching interfaces using flexible property matching
        const matchingInterfaceIds = new Set<string>();
        const matchingNodeIds = new Set<string>();

        for (const criteria of focusInterfaces) {
            let foundMatch = false;

            for (const [interfaceId, { interface: iface, nodeId }] of allInterfaces) {
                if (this.matchesInterface(iface, criteria)) {
                    matchingInterfaceIds.add(interfaceId);
                    matchingNodeIds.add(nodeId);
                    foundMatch = true;
                }
            }

            if (!foundMatch) {
                warnings.push(`No interfaces matched criteria: "${criteria}"`);
            }
        }

        if (matchingInterfaceIds.size === 0) {
            return { activeRelationships: relationships, warnings };
        }

        // Find relationships that involve these interfaces
        const activeRelationships = relationships.filter(rel => {
            const relType = rel['relationship-type'];

            // Check if it's a 'connects' relationship that uses our interfaces
            if ('connects' in relType) {
                const connects = relType.connects;
                const sourceInterfaces = connects.source.interfaces ?? [];
                const destInterfaces = connects.destination.interfaces ?? [];

                return sourceInterfaces.some(id => matchingInterfaceIds.has(id)) ||
                       destInterfaces.some(id => matchingInterfaceIds.has(id));
            }

            return false;
        });

        return {
            activeRelationships,
            interfaceNodes: matchingNodeIds,
            warnings
        };
    }

    /**
     * Interface matching with priority for exact matches over text search.
     * 1. First tries exact interface ID match (case-sensitive and case-insensitive)
     * 2. Only falls back to text search if criteria looks like a search term (not an interface ID)
     */
    private matchesInterface(iface: CalmInterfaceCanonicalModel, criteria: string): boolean {
        const criteriaLower = criteria.toLowerCase().trim();

        // PRIORITY 1: Exact match on interface unique-id (case-sensitive)
        if (iface['unique-id'] === criteria) {
            return true;
        }

        // PRIORITY 2: Case-insensitive exact match on interface unique-id
        if (iface['unique-id'].toLowerCase() === criteriaLower) {
            return true;
        }

        // PRIORITY 3: Only do text search if criteria looks like a search term (not an interface ID)
        // Skip text search for things that look like interface IDs (kebab-case, no spaces)
        const looksLikeInterfaceId = /^[a-z0-9-]+$/i.test(criteria) && !criteria.includes(' ');
        if (looksLikeInterfaceId) {
            // For interface-ID-like criteria, don't do fuzzy text matching
            return false;
        }

        // FALLBACK: Text search for non-interface-ID-like criteria (e.g., "REST", "WebSocket", "v1")
        return this.performTextSearch(iface, criteriaLower);
    }

    /**
     * Performs text search across interface properties for non-interface-ID criteria.
     */
    private performTextSearch(iface: CalmInterfaceCanonicalModel, criteriaLower: string): boolean {
        // Check all properties for partial matches (case-insensitive)
        for (const [key, value] of Object.entries(iface)) {
            if (key === 'unique-id') continue; // Already checked above

            if (typeof value === 'string' && value.toLowerCase().includes(criteriaLower)) {
                return true;
            }

            // For non-string values, convert to string and check
            if (value != null && typeof value !== 'object') {
                if (String(value).toLowerCase().includes(criteriaLower)) {
                    return true;
                }
            }
        }

        return false;
    }
}
