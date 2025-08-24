import {
    CalmRelationship,
    CalmCore,
    CalmNode
} from '@finos/calm-models/model';
import {
    CalmConnectsType,
    CalmInteractsType,
    CalmComposedOfType,
    CalmDeployedInType
} from '@finos/calm-models/types';
import { CalmRelationshipGraph } from './relationship-graph.js';

export type C4ElementType = 'Enterprise' | 'System' | 'Container' | 'Component' | 'Person';

export class C4Element {
    constructor(
        public elementType: C4ElementType,
        public uniqueId: string,
        public name: string,
        public description: string,
        public parentId?: string,
        public children: string[] = []
    ) {}
}

export class C4Relationship {
    constructor(
        public source: string,
        public destination: string,
        public relationshipType: string
    ) {}
}

export function buildParentChildMappings(
    relationships: CalmRelationship[]
): {
    parentLookup: Record<string, string>,
    childrenLookup: Record<string, string[]>
} {
    const parentLookup: Record<string, string> = {};
    const childrenLookup: Record<string, string[]> = {};

    relationships.forEach(rel => {
        const relType = rel.relationshipType;
        switch (relType.kind) {
        case 'composed-of':
        case 'deployed-in': {
            const t = relType as CalmComposedOfType | CalmDeployedInType;
            if (!childrenLookup[t.container]) {
                childrenLookup[t.container] = [];
            }
            childrenLookup[t.container].push(...t.nodes);
            t.nodes.forEach(nodeId => {
                parentLookup[nodeId] = t.container;
            });
            break;
        }
        }
    });

    return { parentLookup, childrenLookup };
}

function sortNodesByHierarchy(
    nodes: CalmNode[],
    parentLookup: Record<string, string>
): CalmNode[] {
    const nodeMap = new Map(nodes.map(node => [node.uniqueId, node]));
    const visited = new Set<string>();
    const sorted: CalmNode[] = [];

    function visit(nodeId: string) {
        if (visited.has(nodeId)) return;

        const node = nodeMap.get(nodeId);
        if (!node) return;

        visited.add(nodeId);

        const parentId = parentLookup[nodeId];
        if (parentId && nodeMap.has(parentId)) {
            visit(parentId);
        }

        sorted.push(node);
    }

    nodes.forEach(node => visit(node.uniqueId));

    return sorted;
}

export class C4Model {
    public elements: Record<string, C4Element> = {};
    public relationships: C4Relationship[] = [];
    public graph: CalmRelationshipGraph;

    constructor(calmCore: CalmCore) {
        this.buildFromCalm(calmCore);
        this.graph = new CalmRelationshipGraph(calmCore.relationships);
    }

    private buildFromCalm(calmCore: CalmCore) {
        const { parentLookup, childrenLookup } = buildParentChildMappings(calmCore.relationships);

        const sortedNodes = sortNodesByHierarchy(calmCore.nodes, parentLookup);

        sortedNodes.forEach(node => {
            const parentId = parentLookup[node.uniqueId];
            const children = childrenLookup[node.uniqueId] || [];

            let finalElementType: C4ElementType;

            if (node.nodeType === 'actor') {
                finalElementType = 'Person';
            } else if (children.length > 0) {
                finalElementType = 'System';
            } else {
                finalElementType = 'Container';
            }

            this.elements[node.uniqueId] = new C4Element(
                finalElementType,
                node.uniqueId,
                node.name,
                node.description,
                parentId,
                [...children]
            );
        });

        calmCore.relationships.forEach(rel => {
            const relType = rel.relationshipType;

            switch (relType.kind) {
            case 'composed-of':
            case 'deployed-in':
                return;

            case 'interacts': {
                const t = relType as CalmInteractsType;

                if (!this.elements[t.actor]) {
                    console.warn(`Actor ${t.actor} not found in relationship ${rel.uniqueId}`);
                    return;
                }

                t.nodes.forEach(nodeId => {
                    if (!this.elements[nodeId]) {
                        console.warn(`Target node ${nodeId} not found in relationship ${rel.uniqueId}`);
                        return;
                    }

                    this.relationships.push(new C4Relationship(
                        t.actor,
                        nodeId,
                        'Interacts With'
                    ));
                });
                break;
            }

            case 'connects': {
                const t = relType as CalmConnectsType;

                if (!this.elements[t.source.node]) {
                    console.warn(`Source node ${t.source.node} not found in relationship ${rel.uniqueId}`);
                    return;
                }
                if (!this.elements[t.destination.node]) {
                    console.warn(`Destination node ${t.destination.node} not found in relationship ${rel.uniqueId}`);
                    return;
                }

                const sourceElement = this.elements[t.source.node];
                const destinationElement = this.elements[t.destination.node];

                if (sourceElement.children.length > 0 || destinationElement.children.length > 0) {
                    return;
                }

                this.relationships.push(new C4Relationship(
                    t.source.node,
                    t.destination.node,
                    'Connects To'
                ));
                break;
            }
            }
        });
    }
}
