import './cytoscape.css';
import { useEffect, useRef } from 'react';
import cytoscape, { EdgeSingular, NodeSingular } from 'cytoscape';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import expandCollapse from 'cytoscape-expand-collapse';
import { Edge, CalmNode } from '../../contracts/contracts.js';
import { LayoutCorrectionService } from '../../services/layout-correction-service.js';
import {
    saveNodePositions,
    loadStoredNodePositions,
} from '../../services/node-position-service.js';

// Initialize Cytoscape plugins
nodeEdgeHtmlLabel(cytoscape);
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
    };
}

function getNodeStyle(showDescription: boolean): cytoscape.Css.Node {
    return {
        label: showDescription
            ? 'data(_displayPlaceholderWithDesc)'
            : 'data(_displayPlaceholderWithoutDesc)',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'text-max-width': '180px',
        'font-family': 'Arial',
        width: '200px',
        height: 'label',
        shape: 'rectangle',
    };
}

const layoutCorrectionService = new LayoutCorrectionService();

const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();

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
                    selector: 'node:selected',
                    style: {
                        backgroundColor: accentColor,
                    }
                },
                {
                    selector: 'edge:selected',
                    style: {
                        'line-color': primaryColor,
                        'target-arrow-color': primaryColor,
                    }
                },
                {
                    selector: ':parent',
                    style: {
                        label: 'data(label)',
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

            cy.fit();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        title,
        nodes,
        edges,
        isNodeDescActive,
        isRelationshipDescActive,
        cyRef,
    ]);

    return <div ref={cyRef} className="flex-1 bg-white visualizer" style={{ height: '100vh' }} />;
}
