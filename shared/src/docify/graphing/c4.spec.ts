import { C4Model } from './c4';
import { CalmCore } from '../../model/core';
import { CalmNode } from '../../model/node';
import {
    CalmRelationship} from '../../model/relationship';

;

describe('C4Model', () => {
    it('should build elements and relationships from a CalmCore using fromSchema', () => {
        // Use CalmNode.fromSchema for all nodes
        const systemNode = CalmNode.fromSchema({
            'unique-id': 'system1',
            'node-type': 'system',
            name: 'System One',
            description: 'A system'
        });
        const service1Node = CalmNode.fromSchema({
            'unique-id': 'service1',
            'node-type': 'service',
            name: 'Service One',
            description: 'A service'
        });
        const actorNode = CalmNode.fromSchema({
            'unique-id': 'actor1',
            'node-type': 'actor',
            name: 'Actor One',
            description: 'An actor'
        });
        const service2Node = CalmNode.fromSchema({
            'unique-id': 'service2',
            'node-type': 'service',
            name: 'Service Two',
            description: 'Another service'
        });

        // Use CalmRelationship.fromSchema for all relationships
        const composedRel = CalmRelationship.fromSchema({
            'unique-id': 'rel1',
            'relationship-type': { 'composed-of': { container: 'system1', nodes: ['service1', 'service2'] } },
            metadata: [{}],
            description: 'system1 is composed of service1 & service2'
        });
        const interactsRel = CalmRelationship.fromSchema({
            'unique-id': 'rel2',
            'relationship-type': { interacts: { actor: 'actor1', nodes: ['service1'] } },
            metadata: [{}],
            description: 'actor1 interacts with service1'
        });
        const connectsRel = CalmRelationship.fromSchema({
            'unique-id': 'rel3',
            'relationship-type': {
                connects: {
                    source: { node: 'service2', interfaces: [] },
                    destination: { node: 'actor1', interfaces: [] }
                }
            },
            metadata: [{}],
            description: 'service2 connects to actor1'
        });

        // Use CalmCore.fromSchema to create the CalmCore instance
        const dummyCalmCore = CalmCore.fromSchema({
            nodes: [
                systemNode.toSchema(),
                service1Node.toSchema(),
                actorNode.toSchema(),
                service2Node.toSchema()
            ],
            relationships: [
                composedRel.toSchema(),
                interactsRel.toSchema(),
                connectsRel.toSchema()
            ]
        });

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
});
