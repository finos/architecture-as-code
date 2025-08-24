import { C4Model } from './c4';
import { CalmCore, CalmNode, CalmRelationship } from '@finos/calm-models/model';


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

    it('should filter out connects relationships between System boundaries', () => {
        // Create nodes where some will become System boundaries
        const system1Node = CalmNode.fromSchema({
            'unique-id': 'system1',
            'node-type': 'system',
            name: 'System One',
            description: 'A system'
        });
        const system2Node = CalmNode.fromSchema({
            'unique-id': 'system2',
            'node-type': 'system',
            name: 'System Two',
            description: 'Another system'
        });
        const service1Node = CalmNode.fromSchema({
            'unique-id': 'service1',
            'node-type': 'service',
            name: 'Service One',
            description: 'A service'
        });
        const service2Node = CalmNode.fromSchema({
            'unique-id': 'service2',
            'node-type': 'service',
            name: 'Service Two',
            description: 'Another service'
        });
        const loadBalancerNode = CalmNode.fromSchema({
            'unique-id': 'load-balancer',
            'node-type': 'service',
            name: 'Load Balancer',
            description: 'External load balancer'
        });

        // Create relationships that make system1 and system2 into System boundaries
        const composedRel1 = CalmRelationship.fromSchema({
            'unique-id': 'rel1',
            'relationship-type': { 'composed-of': { container: 'system1', nodes: ['service1'] } },
            metadata: [{}],
            description: 'system1 is composed of service1'
        });
        const composedRel2 = CalmRelationship.fromSchema({
            'unique-id': 'rel2',
            'relationship-type': { 'composed-of': { container: 'system2', nodes: ['service2'] } },
            metadata: [{}],
            description: 'system2 is composed of service2'
        });

        // Create connects relationships - some should be filtered out
        const connectsBetweenSystems = CalmRelationship.fromSchema({
            'unique-id': 'rel3',
            'relationship-type': {
                connects: {
                    source: { node: 'system1', interfaces: [] },
                    destination: { node: 'system2', interfaces: [] }
                }
            },
            metadata: [{}],
            description: 'system1 connects to system2 - should be filtered out'
        });
        const connectsToSystem = CalmRelationship.fromSchema({
            'unique-id': 'rel4',
            'relationship-type': {
                connects: {
                    source: { node: 'load-balancer', interfaces: [] },
                    destination: { node: 'system1', interfaces: [] }
                }
            },
            metadata: [{}],
            description: 'load-balancer connects to system1 - should be filtered out'
        });
        const connectsBetweenContainers = CalmRelationship.fromSchema({
            'unique-id': 'rel5',
            'relationship-type': {
                connects: {
                    source: { node: 'service1', interfaces: [] },
                    destination: { node: 'service2', interfaces: [] }
                }
            },
            metadata: [{}],
            description: 'service1 connects to service2 - should be kept'
        });

        const dummyCalmCore = CalmCore.fromSchema({
            nodes: [
                system1Node.toSchema(),
                system2Node.toSchema(),
                service1Node.toSchema(),
                service2Node.toSchema(),
                loadBalancerNode.toSchema()
            ],
            relationships: [
                composedRel1.toSchema(),
                composedRel2.toSchema(),
                connectsBetweenSystems.toSchema(),
                connectsToSystem.toSchema(),
                connectsBetweenContainers.toSchema()
            ]
        });

        const model = new C4Model(dummyCalmCore);

        // Verify elements are created correctly
        expect(model.elements['system1'].elementType).toBe('System');
        expect(model.elements['system2'].elementType).toBe('System');
        expect(model.elements['service1'].elementType).toBe('Container');
        expect(model.elements['service2'].elementType).toBe('Container');
        expect(model.elements['load-balancer'].elementType).toBe('Container');

        // Verify that connects relationships between System boundaries are filtered out
        const systemToSystemConnection = model.relationships.find(
            (rel) => rel.source === 'system1' && rel.destination === 'system2'
        );
        expect(systemToSystemConnection).toBeUndefined();

        const loadBalancerToSystemConnection = model.relationships.find(
            (rel) => rel.source === 'load-balancer' && rel.destination === 'system1'
        );
        expect(loadBalancerToSystemConnection).toBeUndefined();

        // Verify that connects relationships between Containers are kept
        const serviceToServiceConnection = model.relationships.find(
            (rel) => rel.source === 'service1' && rel.destination === 'service2'
        );
        expect(serviceToServiceConnection).toBeDefined();
        expect(serviceToServiceConnection?.relationshipType).toBe('Connects To');
    });
});
