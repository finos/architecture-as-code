import {
    CalmNodeCanonicalModel,
    CalmRelationshipCanonicalModel,
} from '@finos/calm-models/canonical';
import { VMEdge, EdgeLabels } from '../../types';
import { VMFactoryProvider } from '../factories/factory-provider';
import { EdgeConfig } from '../factories/vm-factory-interfaces';

/**
 * Builds a lookup map from node ID to interface ID to interface name.
 * This is used for generating fallback edge labels when relationship descriptions
 * are missing but interface information is available.
 */
export function buildInterfaceNameMap(nodes: CalmNodeCanonicalModel[]): Map<string, Map<string, string>> {
    const map = new Map<string, Map<string, string>>();
    for (const n of nodes) {
        if (!Array.isArray(n.interfaces)) continue;
        const inner = new Map<string, string>();
        for (const itf of n.interfaces) {
            const name = typeof itf.name === 'string' ? itf.name : itf['unique-id'];
            inner.set(itf['unique-id'], name);
        }
        if (inner.size) map.set(n['unique-id'], inner);
    }
    return map;
}

/**
 * Merges labels from multiple relationships that have been collapsed into a single edge
 */
function mergeRelationshipLabels(relationships: CalmRelationshipCanonicalModel[], edgeLabelMode: EdgeLabels): string | undefined {
    if (edgeLabelMode === 'none') {
        return undefined;
    }

    const labels = relationships
        .map(rel => rel.description)
        .filter(desc => desc && desc.trim().length > 0);

    if (labels.length === 0) {
        return `${relationships.length} connections`;
    }

    if (labels.length === 1) {
        return labels[0];
    }

    // Multiple descriptions - combine them or show count
    const uniqueLabels = Array.from(new Set(labels));
    if (uniqueLabels.length === 1) {
        return uniqueLabels[0]; // All descriptions are the same
    }

    if (uniqueLabels.length <= 3) {
        return uniqueLabels.join(', '); // Show all if few enough
    }

    return `${relationships.length} connections`; // Too many to show individually
}

/**
 * Converts relationship models into view model edges for rendering.
 * Now uses the factory pattern for elegant, testable edge creation.
 */
export function buildEdges(
    relationships: CalmRelationshipCanonicalModel[],
    renderInterfaces: boolean,
    edgeLabelMode: EdgeLabels,
    collapseRelationships: boolean,
    ifaceNames: Map<string, Map<string, string>>,
    nodesById: Map<string, CalmNodeCanonicalModel>
): VMEdge[] {
    const edgeFactory = VMFactoryProvider.getEdgeFactory();
    const config: EdgeConfig = {
        renderInterfaces,
        edgeLabelMode,
        collapseRelationships,
        ifaceNames,
        nodesById
    };

    // First, create all edges from individual relationships and maintain mapping
    const edgeToRelationshipMap = new Map<VMEdge, CalmRelationshipCanonicalModel>();
    const allEdges: VMEdge[] = [];

    for (const relationship of relationships) {
        const edges = edgeFactory.createEdge(relationship, config);
        for (const edge of edges) {
            allEdges.push(edge);
            edgeToRelationshipMap.set(edge, relationship);
        }
    }

    if (!collapseRelationships) {
        return allEdges;
    }

    // Collapse relationships: group by source-target pair and merge labels
    const edgeMap = new Map<string, VMEdge>();
    const relationshipGroups = new Map<string, CalmRelationshipCanonicalModel[]>();

    // Group edges by source-target pair
    for (const edge of allEdges) {
        const key = `${edge.source}->${edge.target}`;
        const relationship = edgeToRelationshipMap.get(edge);

        if (!relationship) {
            // This should not happen with correct synchronization, but handle gracefully
            console.warn(`No relationship mapping found for edge ${edge.id} (${key})`);
            continue;
        }
        
        if (!edgeMap.has(key)) {
            edgeMap.set(key, { ...edge });
            relationshipGroups.set(key, [relationship]);
        } else {
            // Accumulate relationships for this source-target pair
            const existing = relationshipGroups.get(key);
            if (existing) {
                existing.push(relationship);
            } else {
                // This should not happen, but handle gracefully
                console.warn(`No relationship group found for key ${key}`);
                relationshipGroups.set(key, [relationship]);
            }
        }
    }

    // Merge labels and IDs for collapsed edges
    for (const [key, relationships] of relationshipGroups.entries()) {
        if (relationships.length > 1) {
            const edge = edgeMap.get(key)!;
            edge.label = mergeRelationshipLabels(relationships, edgeLabelMode);
            edge.id = relationships.map(r => r['unique-id']).join('|');
        }
    }

    return Array.from(edgeMap.values());
}
