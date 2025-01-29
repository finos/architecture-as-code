/* eslint-disable @typescript-eslint/no-unused-vars */
import './cytoscape.css';
import { useContext, useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import expandCollapse from 'cytoscape-expand-collapse';
import Sidebar from '../sidebar/Sidebar';
import { ZoomContext } from '../zoom-context.provider';

//Make some information available on tooltip hover

nodeEdgeHtmlLabel(cytoscape);
expandCollapse(cytoscape);

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
    const { zoomLevel, updateZoom } = useContext(ZoomContext);
    const [selectedNode, setSelectedNode] = useState<Node['data'] | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge['data'] | null>(null);

    function getNodeLabelTemplateGenerator(selected=false): (data: Node["data"]) => string {
        return (data: Node['data']) => {
            return `<div class="node element ${selected ? 'selected-node' : ''}">
                        <p class="title">${data.label}</p>
                        <p class="type">${data.type}</p>
                        <p class="description">${isNodeDescActive ? data.description : ''}</p>
                    </div>`;
        }
    }

    useEffect(() => {
        if (cy) {
            //Ensure cytoscape zoom and context state are synchronised
            if (cy.zoom() !== zoomLevel) {
                updateZoom(cy.zoom());
            }
            /* eslint-disable @typescript-eslint/no-explicit-any */
            (cy as Core & { nodeHtmlLabel: any }).nodeHtmlLabel([
                {
                    query: '.node',
                    tpl: getNodeLabelTemplateGenerator(false)
                },
                {
                    query: '.node:selected',
                    tpl: getNodeLabelTemplateGenerator(true)
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

            cy.on('zoom', () => updateZoom(cy.zoom()));
        }
    }, [cy, zoomLevel, updateZoom, isNodeDescActive]);

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
                        selector: 'node',
                        style: {
                            width: '200px',
                            height: '100px',
                            shape: 'rectangle',
                        },
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
            })
        );
    }, [nodes, edges, isConDescActive]); // Re-render on cy, nodes or edges change

    useEffect(() => {
        //Ensure cytoscape zoom and context state are synchronised
        if (cy?.zoom() !== zoomLevel) {
            cy?.zoom(zoomLevel);
        }
    }, [zoomLevel]);

    return (
        <div className="relative flex m-auto border">
            {title && (
                <div className="graph-title absolute m-5 bg-primary shadow-md">
                    <span className="text-m font-thin">Architecture: </span>
                    <span className="text-m font-semibold">{title}</span>
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
