import './cytoscape.css';
import { useEffect, useRef } from 'react';
import cytoscape, { EdgeSingular, NodeSingular } from 'cytoscape';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import { Edge, CalmNode } from '../../contracts/contracts.js';
import { LayoutCorrectionService } from '../../services/layout-correction-service.js';
import {
    saveNodePositions,
    loadStoredNodePositions,
} from '../../services/node-position-service.js';

// Initialize Cytoscape plugins
nodeEdgeHtmlLabel(cytoscape);

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

function getNodeLabelTemplateGenerator(selected: boolean, includeDescription: boolean) {
    return (data: CalmNode['data']) => `
        <div class="node element ${selected ? 'selected-node' : ''}">
            <p class="title">${data.label}</p>
            <p class="type">${data.type}</p>
            <p class="description">${includeDescription ? data.description : ''}</p>
        </div>
    `;
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

        // This function comes from a plugin which doesn't have proper types, which is why the hacky casting is needed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cy as unknown as any).nodeHtmlLabel([
            {
                query: '.node',
                valign: 'top',
                valignBox: 'top',
                tpl: getNodeLabelTemplateGenerator(false, isNodeDescActive),
            },
            {
                query: '.node:selected',
                valign: 'top',
                valignBox: 'top',
                tpl: getNodeLabelTemplateGenerator(true, isNodeDescActive),
            },
        ]);

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
