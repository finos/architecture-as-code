import {
    CalmComposedOfType,
    CalmConnectsType,
    CalmInteractsType,
    CalmRelationship
} from '../../model/relationship';
import {CalmCore} from '../../model/core.js';
import {CalmRelationshipGraph} from './relationship-graph.js';

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

export function buildParentChildMappings(relationships: CalmRelationship[]): {
    parentLookup: Record<string, string>,
    childrenLookup: Record<string, string[]>
} {
    const parentLookup: Record<string, string> = {};
    const childrenLookup: Record<string, string[]> = {};

    relationships.forEach(rel => {
        if (rel.relationshipType instanceof CalmComposedOfType) {
            const composedRel = rel.relationshipType as CalmComposedOfType;
            const { container, nodes } = composedRel;

            if (!childrenLookup[container]) {
                childrenLookup[container] = [];
            }
            childrenLookup[container].push(...nodes);

            nodes.forEach(nodeId => {
                parentLookup[nodeId] = container;
            });
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
            'actor': 'Person'
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
            if (rel.relationshipType instanceof CalmComposedOfType) {
                // Already handled via parent-child mapping, skip adding to relationships
                return;
            }
            else if (rel.relationshipType instanceof CalmInteractsType) {
                const interactsRelationship = rel.relationshipType as CalmInteractsType;

                interactsRelationship.nodes.forEach(nodeId => {
                    this.relationships.push(new C4Relationship(
                        interactsRelationship.actor,
                        nodeId,
                        'Interacts With'
                    ));
                });
            }
            else if (rel.relationshipType instanceof CalmConnectsType) {
                const connectsRelationship = rel.relationshipType as CalmConnectsType;

                this.relationships.push(new C4Relationship(
                    connectsRelationship.source.node,
                    connectsRelationship.destination.node,
                    'Connects To'
                ));
            }
        });
    }
}



