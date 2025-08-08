import {
    CalmComposedOfType,
    CalmConnectsType,
    CalmDeployedInType,
    CalmInteractsType,
    CalmRelationship,
} from '../../model/relationship';
import { CalmCore } from '../../model/core.js';
import { CalmRelationshipGraph } from './relationship-graph.js';

export type C4ElementType = 'System' | 'Container' | 'Component' | 'Person';

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

export class C4Model {
    public elements: Record<string, C4Element> = {};
    public relationships: C4Relationship[] = [];
    public graph: CalmRelationshipGraph;

    constructor(calmCore: CalmCore) {
        this.buildFromCalm(calmCore);
        this.graph = new CalmRelationshipGraph(calmCore.relationships);
    }

    private buildFromCalm(calmCore: CalmCore) {
        const nodeTypeMapping: Record<string, C4ElementType> = {
            'system': 'System',
            'service': 'Container',
            'actor': 'Person',
            'network': 'Container',
        };

        const { parentLookup, childrenLookup } = buildParentChildMappings(calmCore.relationships);

        calmCore.nodes.forEach(node => {
            const elementType = nodeTypeMapping[node.nodeType] || 'Container';
            const parentId = parentLookup[node.uniqueId];
            const children = childrenLookup[node.uniqueId] || [];

            this.elements[node.uniqueId] = new C4Element(
                elementType,
                node.uniqueId,
                node.name,
                node.description,
                parentId,
                children
            );
        });

        Object.values(this.elements).forEach(node => {
            if (node.parentId && this.elements[node.parentId]) {
                this.elements[node.parentId].children.push(node.uniqueId);
            }
        });

        calmCore.relationships.forEach(rel => {
            const relType = rel.relationshipType;

            switch (relType.kind) {
            case 'composed-of':
                return; // skip

            case 'interacts': {
                const t = relType as CalmInteractsType;
                t.nodes.forEach(nodeId => {
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
