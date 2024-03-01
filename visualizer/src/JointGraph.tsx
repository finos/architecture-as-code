import * as joint from "@joint/core";
import { useEffect } from 'react';
import { Relationship, Node } from './Types';
import { DirectedGraph } from '@joint/layout-directed-graph';
import { ShapeFactory } from './ShapeFactory';
import { RelationshipFactory } from './RelationshipFactory';
import { TextElement } from './TextElement';

interface Props {
    nodes: Node[],
    relationships: Relationship[]
}

const shapes: Record<string, joint.shapes.standard.Rectangle> = {};

let popup: joint.shapes.standard.Rectangle;

function createRelationships(graph: joint.dia.Graph, relationships: Relationship[]) {
    const relationshipFactory: RelationshipFactory = new RelationshipFactory(graph, shapes);

    relationships.forEach(relationship => {
        if (relationship.relationshipType === 'connects') {
            relationshipFactory.createConnectsRelationship(relationship);
        } else if (relationship.relationshipType === 'deployed-in') {
            relationshipFactory.createDeployedInRelationship(relationship);
        } else if (relationship.relationshipType === 'interacts') {
            relationshipFactory.createInteractsRelationship(relationship);
        } else if (relationship.relationshipType === 'composed-of') {
            relationshipFactory.createComposedOfRelationship(relationship);
        }
    });
}

function createNodes(graph: joint.dia.Graph, nodes: Node[]) {
    const shapeFactory: ShapeFactory = new ShapeFactory(graph);

    nodes.forEach(node => {
        if (node.nodeType === 'actor') {
            const circle = shapeFactory.createCircleNode(node);
            shapes[node.uniqueId] = circle;
        } else if (node.nodeType === 'internal-network') {
            const rect = shapeFactory.createInternalNetworkNode(node);
            shapes[node.uniqueId] = rect;
        } else {
            const rect = shapeFactory.createRectangleNode(node);
            shapes[node.uniqueId] = rect;
        }
    });
}

function createClickEvents(paper: joint.dia.Paper, graph: joint.dia.Graph) {
    paper.on('cell:contextmenu', (cellView, _evt, x, y) => {
        if (popup)
            popup.remove();

        const element = new TextElement();
        element.attr({
            label: {
                text: JSON.stringify(cellView.model.attributes.extra, null, 2),
                fill: 'black',
                textAnchor: 'left',
                xAlignment: 'left'
            },
            r: {
                ref: 'label',
                x: 'calc(x-10)',
                y: 'calc(y)',
                width: 'calc(w+20)',
                height: 'calc(h)'
            }
        });
        element.position(x, y);
        element.addTo(graph);
        popup = element;
    });

    paper.on('blank:pointerdown', () => {
        popup.remove();
    });
}

function applyLayout(graph: joint.dia.Graph) {
    DirectedGraph.layout(graph, {
        nodeSep: 10,
        edgeSep: 5,
        rankDir: "TB",
        marginX: 30,
        marginY: 10
    });
}

export function JointGraph({ nodes, relationships }: Props) {
    useEffect(() => {
        const namespace = joint.shapes;
        const graph = new joint.dia.Graph({}, { cellNamespace: namespace });
        
        const paper = new joint.dia.Paper({
            el: document.getElementById('joint'),
            model: graph,
            width: 2600,
            height: 1000,
            gridSize: 1,
            cellViewNamespace: namespace,
            background: {
                color: 'white'
            }
        });

        paper.scale(0.8, 0.8);
        
        createClickEvents(paper, graph);
        createNodes(graph, nodes);
        createRelationships(graph, relationships);
        applyLayout(graph);
    })

    return (
        <div id='joint'></div>
    );
}
