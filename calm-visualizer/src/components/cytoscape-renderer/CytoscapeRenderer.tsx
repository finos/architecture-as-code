/* eslint-disable @typescript-eslint/no-unused-vars */
import './cytoscape.css';
import { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import coseBilkent from 'cytoscape-cose-bilkent';
import expandCollapse from 'cytoscape-expand-collapse';
import fcose from 'cytoscape-fcose';
import Sidebar from '../sidebar/Sidebar';

//Make some information available on tooltip hover

nodeHtmlLabel(cytoscape);
nodeEdgeHtmlLabel(cytoscape);
expandCollapse(cytoscape);

cytoscape.use(fcose);
cytoscape.use(coseBilkent);

const fcoseLayoutOptions = {
    name: 'fcose',
    animate: false,
    samplingType: true,
    // Sample size to construct distance matrix
    sampleSize: 25,
    // Separation amount between nodes
    nodeSeparation: 175,
    // Power iteration tolerance
    piTol: 0.0000001,
    nodeRepulsion: (_node: unknown) => 450000,
    // Ideal edge (non nested) length
    idealEdgeLength: (_edge: unknown) => 500,
    // Divisor to compute edge forces
    edgeElasticity: (_edge: unknown) => 0.85,
    // Nesting factor (multiplier) to compute ideal edge length for nested edges
    nestingFactor: 0.1,
    // Maximum number of iterations to perform - this is a suggested value and might be adjusted by the algorithm as required
    numIter: 25000,
    gravity: 0.9,
    // Gravity range (constant) for compounds
    gravityRangeCompound: 1.5,
    // Gravity force (constant) for compounds
    gravityCompound: 1.0,
    // Gravity range (constant)
    gravityRange: 3.8,
    // Initial cooling factor for incremental layout
    initialEnergyOnIncremental: 0.3,
};

export type Node = {
    classes?: string;
    data: {
        label: string;
        id: string;
        [idx: string]: string;
    };
};

export type Edge = {
    data: {
        id: string;
        label: string;
        source: string;
        target: string;
        [idx: string]: string;
    };
};

interface Props {
    title: string;
    nodes: Node[];
    edges: Edge[];
}

const CytoscapeRenderer = ({ title, nodes = [], edges = [] }: Props) => {
    const cyRef = useRef<HTMLDivElement>(null);
    const [cy, setCy] = useState<Core | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node['data'] | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge['data'] | null>(null);

    useEffect(() => {
        if (cy) {
            //@ts-expect-error types are missing from the library
            cy.nodeHtmlLabel([
                {
                    query: '.node',
                    halign: 'center',
                    valign: 'center',
                    halignBox: 'center',
                    valignBox: 'center',
                    tpl: (data: Node['data']) => {
                        return `<div class="node element">
                                    <p class="title">${data.label}</p>
                                    <p class="type">[database]</p>
                                </div>`;
                    },
                },
            ]);

            //@ts-expect-error types are missing from the library
            cy.on('tap', 'node', (e: Event) => {
                e.preventDefault();
                const node = e.target as unknown as NodeSingular | null;
                setSelectedEdge(null);
                setSelectedNode(node?.data()); // Update state with the clicked node's data
            });

            //@ts-expect-error types are missing from the library
            cy.on('tap', 'edge', (e: Event) => {
                e.preventDefault();
                const edge = e.target as unknown as EdgeSingular | null;
                setSelectedNode(null);
                setSelectedEdge(edge?.data()); // Update state with the clicked node's data
            });

            return () => {
                cy.destroy();
            };
        }
    }, [cy]);

    useEffect(() => {
        // Initialize Cytoscape instance
        const container = cyRef.current;

        if (!container) return;

        setCy(
            cytoscape({
                container: container, // container to render
                elements: [...nodes, ...edges], // graph data
                style: [
                    {
                        selector: 'node',
                        style: {
                            width: '200px',
                            height: '100px',
                            shape: 'rectangle',
                        },
                    },
                    {
                        selector: 'edge',
                        style: {
                            width: 2,
                            'curve-style': 'bezier',
                            label: 'data(label)', // labels from data property
                            'target-arrow-shape': 'triangle',
                            'text-wrap': 'ellipsis',
                            'text-background-color': 'white',
                            'text-background-opacity': 1,
                            'text-background-padding': '5px',
                        },
                    },
                    {
                        selector: ':parent',
                        style: {
                            label: 'data(label)',
                        },
                    },
                ],
                layout: fcoseLayoutOptions,
            })
        );
    }, [nodes, edges]); // Re-render on cy, nodes or edges change

    return (
        <div className="relative flex m-auto border">
            <div className="text-l font-bold absolute">{title}</div>
            <div
                ref={cyRef}
                className="flex-1 bg-white visualizer"
                style={{
                    height: '100vh',
                }}
            />
            {selectedNode && (
                <div className="absolute right-0 h-full">
                    <Sidebar
                        selectedData={selectedNode}
                        closeSidebar={() => setSelectedNode(null)}
                    />
                </div>
            )}

            {selectedEdge && (
                <div className="absolute right-0 h-full">
                    <Sidebar
                        selectedData={selectedEdge}
                        closeSidebar={() => setSelectedEdge(null)}
                    />
                </div>
            )}
        </div>
    );
};

export default CytoscapeRenderer;
