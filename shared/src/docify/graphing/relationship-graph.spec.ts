import { CalmRelationshipGraph } from './relationship-graph';
import { CalmRelationship } from '@finos/calm-models/model';


describe('CalmRelationshipGraph', () => {
    // Use CalmRelationshipSchema and .fromSchema for model consistency
    const interactsRel = CalmRelationship.fromSchema({
        'unique-id': 'rel1',
        description: 'actor1 interacts with service1',
        'relationship-type': { interacts: { actor: 'actor1', nodes: ['service1'] } },
        metadata: {},
    });

    const connectsRel = CalmRelationship.fromSchema({
        'unique-id': 'rel2',
        description: 'service2 connects to actor2',
        'relationship-type': { connects: { source: { node: 'service2', interfaces: [] }, destination: { node: 'actor2', interfaces: [] } } },
        metadata: {},
    });

    const deployedInRel = CalmRelationship.fromSchema({
        'unique-id': 'rel3',
        description: 'container1 deployed in node1 and node2',
        'relationship-type': { 'deployed-in': { container: 'container1', nodes: ['node1', 'node2'] } },
        metadata: {},
    });

    const composedOfRel = CalmRelationship.fromSchema({
        'unique-id': 'rel4',
        description: 'composed1 is composed of nodeA and nodeB',
        'relationship-type': { 'composed-of': { container: 'composed1', nodes: ['nodeA', 'nodeB'] } },
        metadata: {},
    });

    const relationships = [interactsRel, connectsRel, deployedInRel, composedOfRel];
    const graph = new CalmRelationshipGraph(relationships);

    test('isRelated returns true for directly connected nodes', () => {
        expect(graph.isRelated('actor1', 'service1')).toBe(true);
        expect(graph.isRelated('service1', 'actor1')).toBe(true);
        expect(graph.isRelated('service2', 'actor2')).toBe(true);
        expect(graph.isRelated('container1', 'node1')).toBe(true);
        expect(graph.isRelated('composed1', 'nodeA')).toBe(true);
    });

    test('isRelated returns false for unconnected nodes', () => {
        expect(graph.isRelated('actor1', 'node1')).toBe(false);
        expect(graph.isRelated('service2', 'nodeA')).toBe(false);
    });

    test('isNodeInRelationship returns true for nodes in relationships', () => {
        expect(graph.isNodeInRelationship('actor1')).toBe(true);
        expect(graph.isNodeInRelationship('service1')).toBe(true);
        expect(graph.isNodeInRelationship('nodeA')).toBe(true);
    });

    test('isNodeInRelationship returns false for nodes not in relationships', () => {
        expect(graph.isNodeInRelationship('nonexistent')).toBe(false);
    });

    test('getRelatedNodes returns correct neighbors', () => {
        const relatedToActor1 = graph.getRelatedNodes('actor1');
        expect(relatedToActor1).toContain('service1');
        const relatedToContainer1 = graph.getRelatedNodes('container1');
        expect(relatedToContainer1).toEqual(expect.arrayContaining(['node1', 'node2']));
    });

    test('getRelatedRelationships returns relationships involving a given node', () => {
        const relsActor1 = graph.getRelatedRelationships('actor1');
        expect(relsActor1).toHaveLength(1);
        expect(relsActor1[0].uniqueId).toBe('rel1');
        const relsNode1 = graph.getRelatedRelationships('node1');
        expect(relsNode1).toHaveLength(1);
        expect(relsNode1[0].uniqueId).toBe('rel3');
        const relsService2 = graph.getRelatedRelationships('service2');
        expect(relsService2).toHaveLength(1);
        expect(relsService2[0].uniqueId).toBe('rel2');
    });
});
