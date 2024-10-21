import { Digraph, Subgraph, Node, Edge, toDot, attribute } from 'ts-graphviz';
import { CALMInstantiation, CALMComposedOfRelationship, CALMConnectsRelationship, CALMDeployedInRelationship, CALMInteractsRelationship, CALMRelationship, CALMNode } from './types.js';

const idToNode: {[id: string]: Node} = {};

export function calmToDot(calm: CALMInstantiation): string {

    const G = new Digraph({
        layout: 'fdp',
        sep: '+80,50'
    });

    calm.nodes.forEach(node => {
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
    } else if (node['node-type'] === 'network') {
        // do not create node as this will be a subgraph later
    } else {
        createNode(G, node, 'box');
    }
}

function createNode(G: Digraph, node: CALMNode, shape: string) {
    const graphNode = new Node(node['unique-id'], {
        [attribute.shape]: shape,
        label: `${node.name}\n\n${addNewLines(node.description, 25)}`
    });
    idToNode[node['unique-id']] = graphNode;
    G.addNode(graphNode);
}

function addNewLines(input: string, maxCharsPerLine: number): string {
    let output = '';
    let currentLineLength = 0;
    input.split(' ').forEach(word => {
        if (currentLineLength + word.length < maxCharsPerLine) {
            output += word;
            output += ' ';
            currentLineLength += word.length;
        } else {
            output += '\n';
            output += word;
            output += ' ';
            currentLineLength = word.length;
        }
    });
    return output;
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

    g.addEdge(new Edge([
        getNode(sourceId),
        getNode(destinationId)
    ], {
        label: `${relationship.description || 'connects'}\n [${relationship.protocol || ''} ${relationship.authentication || ''}]`
    }));
}

function addInteractsRelationship(g: Digraph, relationship: CALMInteractsRelationship) {
    const sourceId = relationship['relationship-type'].interacts.actor;
    const targetIds = relationship['relationship-type'].interacts.nodes;
    targetIds.forEach(maybeId => {
        const targetId = maybeId;

        g.addEdge(new Edge([
            getNode(sourceId),
            getNode(targetId)
        ], {
            label: `${relationship.description || 'interacts'}`
        }));
    });
}

function addDeployedInRelationship(g: Digraph, relationship: CALMDeployedInRelationship) {
    const containerId = relationship['relationship-type']['deployed-in'].container;
    const targetIds = relationship['relationship-type']['deployed-in'].nodes;

    const subgraph = new Subgraph('cluster' + containerId, {
        label: containerId
    });

    targetIds.forEach(targetId => {

        subgraph.addNode(getNode(targetId));
    });
  
    g.addSubgraph(subgraph);
}

function addComposedOfRelationship(g: Digraph, relationship: CALMComposedOfRelationship) {
    const containerId = relationship['relationship-type']['composed-of'].container;
    const targetIds = relationship['relationship-type']['composed-of'].nodes;

    const subgraph = new Subgraph('cluster' + containerId, {
        label: containerId
    });

    targetIds.forEach(targetId => {

        subgraph.addNode(getNode(targetId));
    });
    g.addSubgraph(subgraph);
} 

function getNode(id: string) {
    const node = idToNode[id];
    if (!node) {
        throw new Error(`There does not exist a node with ID [${id}]`);
    } else {
        return node;
    }
}