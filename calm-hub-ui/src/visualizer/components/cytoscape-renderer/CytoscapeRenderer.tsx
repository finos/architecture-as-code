import './cytoscape.css';
import { useContext, useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EdgeSingular, NodeSingular } from 'cytoscape';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import expandCollapse from 'cytoscape-expand-collapse';
import { Sidebar } from '../sidebar/Sidebar.js';
import { ZoomContext } from '../zoom-context.provider.js';
import {
    CalmInterfaceTypeSchema,
    CalmHostPortInterfaceSchema,
    CalmHostnameInterfaceSchema,
    CalmPathInterfaceSchema,
    CalmOAuth2AudienceInterfaceSchema,
    CalmURLInterfaceSchema,
    CalmRateLimitInterfaceSchema,
    CalmContainerImageInterfaceSchema,
    CalmPortInterfaceSchema,
} from '../../../../../shared/src/types/interface-types.js';
import { CalmControlsSchema } from '../../../../../shared/src/types/control-types.js';

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

// Types for nodes and edges
export type CalmNode = {
    classes?: string;
    data: {
        description: string;
        type: string;
        label: string;
        id: string;
        _displayPlaceholderWithDesc: string;
        _displayPlaceholderWithoutDesc: string;
        parent?: string;
        interfaces?: (
            | CalmInterfaceTypeSchema
            | CalmHostPortInterfaceSchema
            | CalmHostnameInterfaceSchema
            | CalmPathInterfaceSchema
            | CalmOAuth2AudienceInterfaceSchema
            | CalmURLInterfaceSchema
            | CalmRateLimitInterfaceSchema
            | CalmContainerImageInterfaceSchema
            | CalmPortInterfaceSchema
        )[];
        controls?: CalmControlsSchema;
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
    nodes: CalmNode[];
    edges: Edge[];
}

export const CytoscapeRenderer = ({
    title,
    nodes = [],
    edges = [],
    isConDescActive,
    isNodeDescActive,
}: Props) => {
    const cyRef = useRef<HTMLDivElement>(null);
    const [cy, setCy] = useState<Core | null>(null);
    const { zoomLevel, updateZoom } = useContext(ZoomContext);
    const [selectedNode, setSelectedNode] = useState<CalmNode['data'] | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge['data'] | null>(null);

    // Generate node label templates
    const getNodeLabelTemplateGenerator =
        (selected = false) =>
        (data: CalmNode['data']) => `
        <div class="node element ${selected ? 'selected-node' : ''}">
            <p class="title">${data.label}</p>
            <p class="type">${data.type}</p>
            <p class="description">${isNodeDescActive ? data.description : ''}</p>
        </div>
    `;

    // Initialize Cytoscape instance
    useEffect(() => {
        const container = cyRef.current;
        if (!container) return;

        // Preserve zoom and pan state if Cytoscape instance already exists
        const currentZoom = cy?.zoom() || 1;
        const currentPan = cy?.pan() || { x: 0, y: 0 };

        // Initialize Cytoscape
        const updatedCy = cytoscape({
            container,
            elements: [...nodes, ...edges],
            style: [
                {
                    selector: 'edge',
                    style: {
                        width: 2,
                        'curve-style': 'bezier',
                        label: isConDescActive ? 'data(label)' : '',
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
                        label: isNodeDescActive
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
            minZoom: 0.1,
            maxZoom: 5,
        });

        // Restore zoom and pan state
        updatedCy.zoom(currentZoom);
        updatedCy.pan(currentPan);

        // Add event listeners
        updatedCy.on('tap', 'node', (e) => {
            const node = e.target as NodeSingular;
            setSelectedEdge(null);
            setSelectedNode(node?.data());
        });

        updatedCy.on('tap', 'edge', (e) => {
            const edge = e.target as EdgeSingular;
            setSelectedNode(null);
            setSelectedEdge(edge?.data());
        });

        updatedCy.on('zoom', () => updateZoom(updatedCy.zoom()));

        // Update node labels dynamically
        /* eslint-disable @typescript-eslint/no-explicit-any */
        (updatedCy as Core & { nodeHtmlLabel: any }).nodeHtmlLabel([
            {
                query: '.node',
                valign: 'top',
                valignBox: 'top',
                tpl: getNodeLabelTemplateGenerator(false),
            },
            {
                query: '.node:selected',
                valign: 'top',
                valignBox: 'top',
                tpl: getNodeLabelTemplateGenerator(true),
            },
        ]);

        // Set Cytoscape instance
        setCy(updatedCy);

        return () => {
            updatedCy.destroy(); // Clean up Cytoscape instance
        };
    }, [nodes, edges, isConDescActive, isNodeDescActive, updateZoom]);

    // Synchronize zoom level with context
    useEffect(() => {
        if (cy && cy.zoom() !== zoomLevel) {
            cy.zoom(zoomLevel);
        }
    }, [cy, zoomLevel]);

    return (
        <div className="relative flex m-auto border">
            {title && (
                <div className="graph-title absolute m-5 bg-accent shadow-md">
                    <span className="text-m font-thin text-primary-content">Architecture: </span>
                    <span className="text-m font-semibold text-primary-content">{title}</span>
                </div>
            )}
            <div ref={cyRef} className="flex-1 bg-white visualizer" style={{ height: '100vh' }} />
            {selectedNode && (
                <Sidebar selectedData={selectedNode} closeSidebar={() => setSelectedNode(null)} />
            )}
            {selectedEdge && (
                <Sidebar selectedData={selectedEdge} closeSidebar={() => setSelectedEdge(null)} />
            )}
        </div>
    );
};
