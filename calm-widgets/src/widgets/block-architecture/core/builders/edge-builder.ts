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
 * Converts relationship models into view model edges for rendering.
 * Now uses the factory pattern for elegant, testable edge creation.
 */
export function buildEdges(
    relationships: CalmRelationshipCanonicalModel[],
    renderInterfaces: boolean,
    edgeLabelMode: EdgeLabels,
    ifaceNames: Map<string, Map<string, string>>,
    nodesById: Map<string, CalmNodeCanonicalModel>
): VMEdge[] {
    const edgeFactory = VMFactoryProvider.getEdgeFactory();
    const config: EdgeConfig = {
        renderInterfaces,
        edgeLabelMode,
        ifaceNames,
        nodesById
    };

    return relationships.flatMap(relationship =>
        edgeFactory.createEdge(relationship, config)
    );
}
