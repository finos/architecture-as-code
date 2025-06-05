import './cytoscape.css';
import { useEffect, useRef } from 'react';
import cytoscape, { EdgeSingular, NodeSingular } from 'cytoscape';
import expandCollapse from 'cytoscape-expand-collapse';
import { Edge, CalmNode } from '../../contracts/contracts.js';
import { LayoutCorrectionService } from '../../services/layout-correction-service.js';
import {
    saveNodePositions,
    loadStoredNodePositions,
} from '../../services/node-position-service.js';

// Initialize Cytoscape plugins
expandCollapse(cytoscape);

// Layout configuration
const breadthFirstLayout = {
    name: 'breadthfirst',
    fit: true,
    directed: true,
    circle: false,
    grid: true,
    avoidOverlap: true,
    padding: 30,
    spacingFactor: 1.25,
};
// Text font size for node and edge labels
const textFontSize = '20px';

export interface CytoscapeRendererProps {
    title: string;
    isNodeDescActive: boolean;
    isRelationshipDescActive: boolean;
    nodes: CalmNode[];
    edges: Edge[];
    nodeClickedCallback: (x: CalmNode['data'] | Edge['data']) => void;
    edgeClickedCallback: (x: CalmNode['data'] | Edge['data']) => void;
}

function getEdgeStyle(showDescription: boolean): cytoscape.Css.Edge {
    return {
        width: 2,
        'curve-style': 'bezier',
        label: showDescription ? 'data(label)' : '',
        'target-arrow-shape': 'triangle',
        'text-wrap': 'ellipsis',
        'text-background-color': 'white',
        'text-background-opacity': 1,
        'text-background-padding': '5px',
        'font-size': textFontSize,
    };
}

function getNodeStyle(showDescription: boolean): cytoscape.Css.Node {
    return {
        label: showDescription
            ? 'data(labelWithDescription)'
            : 'data(labelWithoutDescription)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '180px',
        'font-family': 'Arial',
        'background-color': '#f5f5f5',
        'border-color': 'black',
        'border-width': 1,
        'padding': '10px',
        'font-size': textFontSize,
        width: '200px',
        height: 'label',
        shape: 'rectangle',
    };
}

const layoutCorrectionService = new LayoutCorrectionService();

export function CytoscapeRenderer({
    nodes = [],
    title = '',
    edges = [],
    isRelationshipDescActive,
    isNodeDescActive,
    nodeClickedCallback,
    edgeClickedCallback,
}: CytoscapeRendererProps) {
    const cyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = cyRef.current;
        if (!container) return;

        const cy = cytoscape({
            container,
            elements: [...nodes, ...edges],
            style: [
                {
                    selector: 'edge',
                    style: getEdgeStyle(isRelationshipDescActive),
                },
                {
                    selector: 'node',
                    style: getNodeStyle(isNodeDescActive),
                },
                {
                    selector: ':parent',
                    style: {
                        label: 'data(label)',
                        "background-color": 'white',
                        "border-style": 'dashed',
                        "border-width": 2,
                        "border-dash-pattern": [8, 10], // [dash length, gap length]
                    },
                },
            ],
            layout: breadthFirstLayout,
            boxSelectionEnabled: true,
            minZoom: 0.1,
            maxZoom: 5,
        });

        const savedPositions = loadStoredNodePositions(title);
        if (savedPositions) {
            cy.nodes().forEach((node) => {
                const match = savedPositions.find((n) => n.id === node.id());
                if (match) {
                    node.position(match.position);
                }
            });
        }

        cy.on('tap', 'node', (e) => {
            const node = e.target as NodeSingular;
            nodeClickedCallback(node?.data());
        });

        cy.on('tap', 'edge', (e) => {
            const edge = e.target as EdgeSingular;
            edgeClickedCallback(edge?.data());
        });

        cy.on('dragfree', 'node', () => {
            const nodePositions = cy.nodes().map((node) => ({
                id: node.id(),
                position: node.position(),
            }));
            saveNodePositions(title, nodePositions);
        });

        layoutCorrectionService.calculateAndUpdateNodePositions(cy, nodes);

        return () => {
            cy.destroy();
        };
    }, [
        title,
        nodes,
        edges,
        isNodeDescActive,
        isRelationshipDescActive,
        nodeClickedCallback,
        edgeClickedCallback,
        cyRef,
    ]);

    return <div ref={cyRef} className="flex-1 bg-white visualizer" style={{ height: '100vh' }} />;
}
