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
        .map(rel => (edgeLabelMode === 'unique-id' ? rel['unique-id'] : rel.description))
        .filter(value => value && value.trim().length > 0);

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

/**
 * Points edges at the drawn copies of their end nodes. A node drawn once connects to every copy of
 * the other end. When both ends have copies, only the copies that share the most containers connect,
 * e.g. two services in the same cluster, and if no copies share a container, one edge connects the
 * first drawings. When one end contains drawings of the other, only those drawings connect.
 */
export function expandEdgesToInstances(
    edges: VMEdge[],
    instancesOf: Map<string, string[]>,
    ancestorsOf: Map<string, string[]>
): VMEdge[] {
    const ancestors = (id: string) => ancestorsOf.get(id) ?? [];
    const contains = (outer: string, inner: string) => ancestors(inner).includes(outer);

    return edges.flatMap(edge => {
        const sources = instancesOf.get(edge.source) ?? [edge.source];
        const targets = instancesOf.get(edge.target) ?? [edge.target];
        if (sources.length === 1 && targets.length === 1) {
            return [{ ...edge, source: sources[0], target: targets[0] }];
        }

        // A container that holds every drawing of both ends does not tell which drawings belong together
        const drawings = [...sources, ...targets];
        const everywhere = new Set(ancestors(drawings[0]).filter(x => drawings.every(d => ancestors(d).includes(x))));
        const sharedContainers = (a: string, b: string) => {
            const ofB = new Set(ancestors(b));
            return ancestors(a).filter(x => ofB.has(x) && !everywhere.has(x)).length;
        };

        const pairs = sources.flatMap(source => targets.map(target => ({ source, target, score: sharedContainers(source, target) })));
        const nested = pairs.filter(p => contains(p.source, p.target) || contains(p.target, p.source));

        const bestForSource = new Map<string, number>();
        const bestForTarget = new Map<string, number>();
        for (const p of pairs) {
            bestForSource.set(p.source, Math.max(bestForSource.get(p.source) ?? 0, p.score));
            bestForTarget.set(p.target, Math.max(bestForTarget.get(p.target) ?? 0, p.score));
        }
        const shared = pairs.filter(p => p.score > 0
            && p.score === bestForSource.get(p.source) && p.score === bestForTarget.get(p.target));
        let kept = nested;
        if (kept.length === 0) kept = sources.length === 1 || targets.length === 1 ? pairs : shared;
        if (kept.length === 0) kept = pairs.slice(0, 1);
        return kept.map((p, i) => ({ ...edge, id: `${edge.id}__${i}`, source: p.source, target: p.target }));
    });
}
