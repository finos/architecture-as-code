import { buildParentChildMappings, C4Model } from './c4';
import { CalmCore } from '../../model/core';
import { CalmNode, CalmNodeDetails } from '../../model/node';
import { CalmMetadata } from '../../model/metadata';
import {
    CalmRelationship,
    CalmComposedOfType,
    CalmConnectsType,
    CalmInteractsType,
    CalmDeployedInType
} from '../../model/relationship';

describe('buildParentChildMappings', () => {
    it('should build parent/child lookups for a composed-of relationship', () => {
        const composedOfRel = new CalmRelationship(
            'rel1',
            new CalmComposedOfType('parent1', ['child1', 'child2']),
            new CalmMetadata({}),
            []
        );
        const { parentLookup, childrenLookup } = buildParentChildMappings([composedOfRel]);
        expect(parentLookup).toEqual({ child1: 'parent1', child2: 'parent1' });
        expect(childrenLookup).toEqual({ parent1: ['child1', 'child2'] });
    });

    it('should build parent/child lookups for a deployed-in relationship', () => {
        const deployedInRel = new CalmRelationship(
            'rel2',
            new CalmDeployedInType('env1', ['service1']),
            new CalmMetadata({}),
            []
        );
        const { parentLookup, childrenLookup } = buildParentChildMappings([deployedInRel]);
        expect(parentLookup).toEqual({ service1: 'env1' });
        expect(childrenLookup).toEqual({ env1: ['service1'] });
    });
});

describe('C4Model', () => {
    it('should build elements and relationships from a CalmCore using direct constructors', () => {
        const systemNode = buildNode('system1', 'system', 'System One', 'A system');
        const service1Node = buildNode('service1', 'service', 'Service One', 'A service');
        const actorNode = buildNode('actor1', 'actor', 'Actor One', 'An actor');
        const service2Node = buildNode('service2', 'service', 'Service Two', 'Another service');

        const composedRel = new CalmRelationship(
            'rel1',
            new CalmComposedOfType('system1', ['service1', 'service2']),
            new CalmMetadata({}),
            [],
            'system1 is composed of service1 & service2'
        );
        const interactsRel = new CalmRelationship(
            'rel2',
            new CalmInteractsType('actor1', ['service1']),
            new CalmMetadata({}),
            [],
            'actor1 interacts with service1'
        );
        const connectsRel = new CalmRelationship(
            'rel3',
            new CalmConnectsType({ node: 'service2', interfaces: [] }, { node: 'actor1', interfaces: []  }),
            new CalmMetadata({}),
            [],
            'service2 connects to actor1'
        );

        const dummyCalmCore: CalmCore = {
            nodes: [systemNode, service1Node, actorNode, service2Node],
            relationships: [composedRel, interactsRel, connectsRel],
            metadata: new CalmMetadata({}),
            controls: [],
            flows: []
        };

        const model = new C4Model(dummyCalmCore);
        expect(model.elements['system1']).toBeDefined();
        expect(model.elements['service1']).toBeDefined();
        expect(model.elements['actor1']).toBeDefined();
        expect(model.elements['service2']).toBeDefined();
        expect(model.elements['system1'].elementType).toBe('System');
        expect(model.elements['service1'].elementType).toBe('Container');
        expect(model.elements['actor1'].elementType).toBe('Person');
        expect(model.elements['service2'].elementType).toBe('Container');
        expect(model.elements['service1'].parentId).toBe('system1');
        expect(model.elements['service2'].parentId).toBe('system1');
        expect(model.elements['system1'].children).toEqual(expect.arrayContaining(['service1', 'service2']));
        const interaction = model.relationships.find(
            (rel) => rel.source === 'actor1' && rel.destination === 'service1' && rel.relationshipType === 'Interacts With'
        );
        expect(interaction).toBeDefined();
        const connection = model.relationships.find(
            (rel) => rel.source === 'service2' && rel.destination === 'actor1' && rel.relationshipType === 'Connects To'
        );
        expect(connection).toBeDefined();
        expect(model.graph).toBeDefined();
    });

    function buildNode(
        uniqueId: string,
        nodeType: 'actor' | 'system' | 'service',
        name: string,
        description: string
    ) {
        return new CalmNode(
            uniqueId,
            nodeType,
            name,
            description,
            new CalmNodeDetails('', ''),
            [],
            [],
            new CalmMetadata({})
        );
    }
});
