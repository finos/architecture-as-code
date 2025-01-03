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
        description: string;
        type: string;
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
    title?: string;
    isNodeDescActive: boolean;
    isConDescActive: boolean;
    nodes: Node[];
    edges: Edge[];
}

const CytoscapeRenderer = ({
    title,
    nodes = [],
    edges = [],
    isConDescActive,
    isNodeDescActive,
}: Props) => {
    const cyRef = useRef<HTMLDivElement>(null);
    const [cy, setCy] = useState<Core | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
    const [selectedNode, setSelectedNode] = useState<Node['data'] | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge['data'] | null>(null);

    useEffect(() => {
        if (cy) {
            setZoomLevel(cy.zoom());
            (cy as any).nodeHtmlLabel([
                {
                    query: '.node',
                    halign: 'center',
                    valign: 'center',
                    halignBox: 'center',
                    valignBox: 'center',
                    tpl: (data: Node['data']) => {
                        return `<div class="node element">
                                    <p class="title">${data.label}</p>
                                    <p class="type">${data.type}</p>
                                    <p class="description">${isNodeDescActive ? data.description : ''}</p>
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

            cy.on('zoom', () => setZoomLevel(cy.zoom()));

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
                        selector: 'edge',
                        style: {
                            width: 2,
                            'curve-style': 'bezier',
                            label: isConDescActive ? 'data(label)' : '', // labels from data property
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

    function zoomIn() {
        //Obtain percentage as integer
        const currentPercentageZoom = Math.round(zoomLevel*100);
        //Add 10% to the zoom or round to upper 10% interval
        const newPercentageZoom = Math.floor(currentPercentageZoom/10)*10 + 10;
        cy?.zoom(newPercentageZoom/100);
        setZoomLevel(newPercentageZoom/100);
    }

    function zoomOut() {
        //Obtain percentage as integer
        const currentPercentageZoom = Math.round(zoomLevel*100);
        //Subtract 10% from the zoom or round to lower 10% interval - but not less than zero
        const newPercentageZoom = Math.max(Math.ceil(currentPercentageZoom/10)*10 - 10, 0);
        cy?.zoom(newPercentageZoom/100);
        setZoomLevel(newPercentageZoom/100);
    }

    return (
        <div className="relative flex m-auto border">
            {title && (
                <div className="graph-title absolute m-5 bg-gray-100 shadow-md">
                    <span className="text-m">Architecture: {title}</span>
                    <div className="text-m mt-2">
                        <span className='zoom-indicator'>Zoom: {(zoomLevel*100).toFixed(0)}%</span>
                        <button className='ms-2 ps-2 pe-2 bg-base-300 cursor-pointer' onClick={zoomIn}>+</button>
                        <button className='ms-2 ps-2 pe-2 bg-base-300 cursor-pointer' onClick={zoomOut}>-</button>
                    </div>        
                </div>
            )}
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
