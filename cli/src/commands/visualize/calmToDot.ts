import { Digraph, Subgraph, Node, Edge, toDot, attribute } from 'ts-graphviz';
import { CALMInstantiation, CALMComposedOfRelationship, CALMConnectsRelationship, CALMDeployedInRelationship, CALMInteractsRelationship, CALMRelationship, CALMNode } from './Types';
import { initLogger } from '../helper.js';
import winston from 'winston';

let logger: winston.Logger;

const idToNode: {[id: string]: Node} = {};

export default function(calm: CALMInstantiation, debug: boolean = false): string {
    logger = initLogger(debug);

    const G = new Digraph({
        nodesep: 0.5
    });

    calm.nodes.forEach(node => {
        logger.debug(`Creating a node with ID [${node['unique-id']}]`);
        addNode(G, node);
    });
    calm.relationships.forEach(relationship => {
        addRelationship(G, relationship);
    });

    return toDot(G)
        .replace(/\n/g, ' ');
}

function addNode(G: Digraph, node: CALMNode) {
    if (node['node-type'] === 'actor') {
        createNode(G, node, 'ellipse');
    } else if (node['node-type'] === 'internal-network') {
        // do not create node as this will be a subgraph later
    } else {
        createNode(G, node, 'box');
    }
}

function createNode(G: Digraph, node: CALMNode, shape: string) {
    const graphNode = new Node(node['unique-id'], {
        [attribute.shape]: shape,
        label: `${capitalizeFirstLetter(node['node-type'])}: ${node.name}`
    });
    idToNode[node['unique-id']] = graphNode;
    G.addNode(graphNode);
}

function capitalizeFirstLetter(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function addRelationship(g: Digraph, relationship: CALMRelationship): void {
    if ('connects' in relationship['relationship-type']) {
        addConnectsRelationship(g, relationship as CALMConnectsRelationship);
    } else if ('interacts' in relationship['relationship-type']) {
        addInteractsRelationship(g, relationship as CALMInteractsRelationship);
    } else if ('deployed-in' in relationship['relationship-type']) {
        addDeployedInRelationship(g, relationship as CALMDeployedInRelationship);
    } else if ('composed-of' in relationship['relationship-type']) {
        addComposedOfRelationship(g, relationship as CALMComposedOfRelationship);
    }
}

function addConnectsRelationship(g: Digraph, relationship: CALMConnectsRelationship) {
    const sourceId = relationship['relationship-type'].connects.source.node;
    const destinationId = relationship['relationship-type'].connects.destination.node;

    const r = relationship['relationship-type'];
    logger.debug(`${JSON.stringify(r)}`);
    logger.debug(`Creating a connects relationship from [${sourceId}] to [${destinationId}]`);
    
    g.addEdge(new Edge([
        idToNode[sourceId],
        idToNode[destinationId]
    ], {
        label: `connects ${relationship.protocol || ''} ${relationship.authentication || ''}`
    }));
}

function addInteractsRelationship(g: Digraph, relationship: CALMInteractsRelationship) {
    const sourceId = relationship['relationship-type'].interacts.actor;
    const targetIds = relationship['relationship-type'].interacts.nodes;
    targetIds.forEach(maybeId => {
        const targetId = maybeId;

        g.addEdge(new Edge([
            idToNode[sourceId],
            idToNode[targetId]
        ], {
            label: 'interacts'
        }));
    });
}

function addDeployedInRelationship(g: Digraph, relationship: CALMDeployedInRelationship) {
    const containerId = relationship['relationship-type']['deployed-in'].container;
    const targetIds = relationship['relationship-type']['deployed-in'].nodes;

    const subgraph = new Subgraph('cluster' + containerId, {
        label: containerId
    });

    targetIds.forEach(maybeId => {
        const targetId = maybeId;
        logger.debug(`Creating a deployed-in relationship from [${containerId}] to [${targetId}]`);

        subgraph.addNode(idToNode[targetId]);
    });
  
    g.addSubgraph(subgraph);
}

function addComposedOfRelationship(g: Digraph, relationship: CALMComposedOfRelationship) {
    const containerId = relationship['relationship-type']['composed-of'].container;
    const targetIds = relationship['relationship-type']['composed-of'].nodes;

    const subgraph = new Subgraph('cluster' + containerId, {
        label: containerId
    });

    targetIds.forEach(maybeId => {
        const targetId = maybeId;
        logger.debug(`Creating a composed-of relationship from [${containerId}] to [${targetId}]`);

        subgraph.addNode(idToNode[targetId]);
    });
    g.addSubgraph(subgraph);
} 