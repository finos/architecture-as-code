import './cytoscape.css';
import { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import nodeHtmlLabel from 'cytoscape-node-html-label';
import coseBilkent from 'cytoscape-cose-bilkent';
import expandCollapse from 'cytoscape-expand-collapse';
import fcose from 'cytoscape-fcose';
import Sidebar from '../sidebar/Sidebar';

//Make some information available on tooltip hover

nodeHtmlLabel(cytoscape);
expandCollapse(cytoscape);

cytoscape.use(fcose);
cytoscape.use(coseBilkent);

const fcoseLayoutOptions: cytoscape.LayoutOptions = {
    name: 'fcose',
};

// const coseBilkentLayoutOptions = {
//     name: 'cose-bilkent',
//     randomize: false,
//     fit: true,
//     padding: 50,
//     nodeDimensionsIncludeLabels: true,
//     nodeRepulsion: 10000,
//     idealEdgeLength: 200,
//     edgeElasticity: 0.1,
//     gravity: 0.25,
//     numIter: 2500,
//     tile: true,
//     tilingPaddingVertical: 50,
//     tilingPaddingHorizontal: 50,
//     animate: false,
//     gravityRangeCompound: 1.5,
//     gravityCompound: 1.0,
//     gravityRange: 3.8,
// };

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
    nodes: Node[];
    edges: Edge[];
}

const CytoscapeRenderer = ({ nodes = [], edges = [] }: Props) => {
    const cyRef = useRef<HTMLDivElement>(null);
    const [cy, setCy] = useState<Core | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(1);
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
                                <p class="type">[${data.type}]</p>
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
                            'text-max-width': '200px',
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
        <div>
            <div className="mt-4">Zoom Level: {(zoomLevel*100).toFixed(0)}%</div>
            <div className="relative flex h-screen w-11/12 m-auto">
                <div
                    ref={cyRef}
                    className="flex-1 bg-white"
                    style={{
                        height: '100vh',
                    }}
                />

                {selectedNode && (
                    <div className="absolute right-0 top-0 h-full">
                        <Sidebar
                            selectedData={selectedNode}
                            closeSidebar={() => setSelectedNode(null)}
                        />
                    </div>
                )}

                {selectedEdge && (
                    <div className="absolute right-0 top-0 h-full">
                        <Sidebar
                            selectedData={selectedEdge}
                            closeSidebar={() => setSelectedEdge(null)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CytoscapeRenderer;
