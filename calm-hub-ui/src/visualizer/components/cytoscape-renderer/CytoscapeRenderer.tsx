import './cytoscape.css';
import { useContext, useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EventObject } from 'cytoscape';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import expandCollapse from 'cytoscape-expand-collapse';
import { Sidebar } from '../sidebar/Sidebar.js';
import { ZoomContext } from '../zoom-context.provider.js';
import { IoAddOutline, IoSaveOutline } from 'react-icons/io5';

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
export type Node = {
    classes?: string;
    data: {
        description: string;
        type: string;
        label: string;
        id: string;
        isShell?: boolean;
        _displayPlaceholderWithDesc: string;
        _displayPlaceholderWithoutDesc: string;
        [idx: string]: string | boolean | undefined;

    };
};

export type Edge = {
    data: {
        id: string;
        label: string;
        source: string;
        target: string;
        isShell?: boolean;
        [idx: string]: string | boolean | undefined;
    };
};

interface Props {
    title?: string;
    isNodeDescActive: boolean;
    isConDescActive: boolean;
    nodes: Node[];
    edges: Edge[];
    onSaveData?: (nodes: Node[], edges: Edge[]) => void;
}

export const CytoscapeRenderer = ({
    title,
    nodes: initialNodes = [],
    edges: initialEdges = [],
    isConDescActive,
    isNodeDescActive,
    onSaveData,
}: Props) => {
    const cyRef = useRef<HTMLDivElement>(null);
    const [cy, setCy] = useState<Core | null>(null);
    const { zoomLevel, updateZoom } = useContext(ZoomContext);
    const [selectedNode, setSelectedNode] = useState<Node['data'] | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<Edge['data'] | null>(null);
    const [edgeCreationSource, setEdgeCreationSource] = useState<string | null>(null);
    const [isInEdgeCreationMode, setIsInEdgeCreationMode] = useState(false);

    // local state for nodes and edges to track changes
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    // custom styles for shell nodes and other elements
    useEffect(() => {
        const styleTag = document.createElement('style');
        styleTag.textContent = `
        .shell-node-container {
            position: relative !important;
            background-color: #ffffff !important;
            border: 2px dashed #0074D9 !important;
            border-radius: 5px !important;
            padding: 10px !important;
            box-sizing: border-box !important;
            width: 200px !important;
            height: 100px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
        }
        .shell-node-container .title {
            color: #666 !important;
            font-style: italic !important;
            margin: 0 !important;
            font-weight: bold !important;
        }
        .add-details-btn {
            margin-top: 5px !important;
            padding: 5px 10px !important;
            background-color: #4CAF50 !important;
            color: white !important;
            border: none !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 12px !important;
        }
        .node.element {
            background-color: #ffffff !important;
            border: 1px solid #cccccc !important;
            border-radius: 5px !important;
            padding: 10px !important;
            width: 200px !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
        }
        .edge-creation-target {
            border: 2px solid #0074D9 !important;
            box-shadow: 0 0 10px rgba(0, 116, 217, 0.5) !important;
        }
        .edge-source {
            border: 2px solid #0074D9 !important;
            box-shadow: 0 0 10px rgba(0, 116, 217, 0.5) !important;
        }
        .selected-node {
            border: 2px solid #FF4136 !important;
            box-shadow: 0 0 5px rgba(255, 65, 54, 0.5) !important;
        }
        `;
        document.head.appendChild(styleTag);

        return () => {
            document.head.removeChild(styleTag);
        };
    }, []);
    // Generate node label templates
    const getNodeLabelTemplateGenerator =
        (selected = false) =>
        (data: Node['data']) => {
            if (data.isShell) {
                // Shell node[new node]
                return `<div class="shell-node-container" data-id="${data.id}">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <p class="title" style="margin: 0; font-weight: bold;">${data.label || 'New Node'}</p>
                        <button class="add-details-btn" data-nodeid="${data.id}">Add Details</button>
                    </div>
                </div>`;
            } else {
                // Regular node
                const isSelectedNode = selectedNode && selectedNode.id === data.id;
                return `<div class="node element ${selected || isSelectedNode ? 'selected-node' : ''}" data-id="${data.id}">
                    <p class="title" style="margin: 0; font-weight: bold;">${data.label}</p>
                    <p class="type" style="margin: 2px 0;">${data.type}</p>
                    <p class="description" style="margin: 2px 0;">${isNodeDescActive ? data.description : ''}</p>
                </div>`;
            }
        };
    // Function to refresh node labels
    const refreshNodeLabels = () => {
        if (cy) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cy as Core & { nodeHtmlLabel: any }).nodeHtmlLabel([
                {
                    query: 'node',
                    tpl: getNodeLabelTemplateGenerator(false),
                    halign: 'center',
                    valign: 'center',
                },
                {
                    query: 'node:selected',
                    tpl: getNodeLabelTemplateGenerator(true),
                    halign: 'center',
                    valign: 'center',
                },
            ]);
        }
    };

    // Handle clicks on node buttons
    useEffect(() => {
        const handleDocumentClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // Handle "Add Details" button click
            if (target.classList.contains('add-details-btn')) {
                event.stopPropagation();
                const nodeId = target.getAttribute('data-nodeid');
                if (nodeId && cy) {
                    const node = cy.getElementById(nodeId);
                    if (node.length > 0) {
                        setSelectedNode(node.data());
                    }
                }
            }
        };

        document.addEventListener('click', handleDocumentClick);
        return () => document.removeEventListener('click', handleDocumentClick);
    }, [cy]);

    // Add a new node to the graph
    const addNode = () => {
        if (cy) {
            const newNodeId = `node-${Date.now()}`;
            const shellNodeData = {
                id: newNodeId,
                label: 'New Node',
                type: '',
                description: '',
                isShell: true,
            };

            setNodes((prev) => [...prev, { classes: 'node', data: shellNodeData }]);

            cy.add({
                group: 'nodes',
                classes: 'node',
                data: shellNodeData,
                position: { x: 300, y: 300 },
            });

            cy.layout(breadthFirstLayout).run();


            refreshNodeLabels();
            setSelectedNode(shellNodeData);
        }
    };

    // Export graph data as JSON
    const saveJSON = () => {
        if (cy) {
            // Get only the nodes and edges that still exist in the Cytoscape instance
            const currentNodeIds = new Set(cy.nodes().map((node) => node.id()));
            const currentEdgeIds = new Set(cy.edges().map((edge) => edge.id()));

            // Filter nodes that still exist and aren't shell nodes
            const formattedNodes = nodes
                .filter((node) => currentNodeIds.has(node.data.id) && !node.data.isShell)
                .map((node: Node) => ({
                    'unique-id': node.data.id,
                    'node-type': node.data.type || '',
                    name: node.data.label || '',
                    description: node.data.description || '',
                    interfaces: [],
                }));

            // Filter edges that still exist and aren't shell edges
            const formattedRelationships = edges
                .filter((edge) => currentEdgeIds.has(edge.data.id) && !edge.data.isShell)
                .map((edge: Edge) => ({
                    'unique-id': edge.data.id,
                    description: edge.data.label || '',
                    'relationship-type': {
                        connects: {
                            source: {
                                node: edge.data.source,
                            },
                            destination: {
                                node: edge.data.target,
                                interfaces: [],
                            },
                        },
                    },
                    protocol: 'HTTPS',
                    authentication: 'OAuth2',
                }));

            const exportData = {
                nodes: formattedNodes,
                relationships: formattedRelationships,
            };

            // Callback for saving data if provided
            if (onSaveData) {
                onSaveData(
                    nodes.filter((node) => currentNodeIds.has(node.data.id) && !node.data.isShell),
                    edges.filter((edge) => currentEdgeIds.has(edge.data.id) && !edge.data.isShell)
                );
            }

            // Create download link
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const exportFileDefaultName = 'architecture_diagram.json';
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
        }
    };

    // Update node or edge data
    const updateElement = (updatedData: Node['data'] | Edge['data']) => {
        if (!cy) return;

        // Check if this is an existing element
        const elementId = selectedNode?.id || selectedEdge?.id || '';
        const originalElement = cy.getElementById(elementId);
        if (originalElement.length === 0) return;

        const finalData = { ...updatedData };

        // Handle shell status
        if (finalData.isShell) {
            finalData.isShell = false;
        }

        // Check if id changed when new node was being edited
        const selectedElementId = selectedNode
            ? selectedNode.id
            : selectedEdge
              ? selectedEdge.id
              : '';
        const idChanged = selectedElementId !== finalData.id;

        if (idChanged && 'type' in finalData) {
            // Create new node with new id
            cy.add({
                group: 'nodes',
                classes: 'node',
                data: finalData,
                position: originalElement.position(),
            });

            // Update edges that reference this node
            cy.edges().forEach((edge) => {
                const edgeData = edge.data();
                let changed = false;

                if (edgeData.source === selectedElementId) {
                    edgeData.source = finalData.id;
                    changed = true;
                }

                if (edgeData.target === selectedElementId) {
                    edgeData.target = finalData.id;
                    changed = true;
                }

                if (changed) {
                    edge.data(edgeData);

                    // Update state for edges
                    setEdges((prev) =>
                        prev.map((e) =>
                            e.data.id === edgeData.id ? { ...e, data: { ...edgeData } } : e
                        )
                    );
                }
            });

            // Remove old node
            originalElement.remove();

            // Update state for nodes
            setNodes((prev) =>
                prev.map((node) =>
                    node.data.id === selectedElementId
                        ? { ...node, classes: 'node', data: finalData as Node['data'] }
                        : node
                )
            );

            // Update selected element for sidebar
            setSelectedNode(finalData);
            setSelectedEdge(null);
        } else {
            // Normal update (the new node id wasn't changed)
            originalElement.data(finalData);
            originalElement.style('visibility', 'visible');

            if ('type' in finalData) {
                setNodes((prev) =>
                    prev.map((node) =>
                        node.data.id === finalData.id
                            ? { ...node, classes: 'node', data: finalData }
                            : node
                    )
                );
                setSelectedNode(finalData);
            } else if ('source' in finalData && 'target' in finalData) {
                setEdges((prev) =>
                    prev.map((edge) =>
                        edge.data.id === finalData.id ? { ...edge, data: finalData } : edge
                    )
                );
                setSelectedEdge(finalData);
            }
        }

        // Always refresh node labels after an update
        setTimeout(() => {
            refreshNodeLabels();
        }, 100);
    };

    // Delete a node or edge
    const deleteElement = (elementId: string) => {
        if (!cy) return;

        const element = cy.getElementById(elementId);
        if (element.length > 0) {
            // Determine if it's a node or edge
            const isNode = element.isNode();

            // If it's a node, also delete all connected edges
            if (isNode) {
                // Find all connected edges
                const connectedEdges = element.connectedEdges();

                // Remove them from the cytoscape instance
                connectedEdges.forEach((edge: { id: () => string }) => {
                    // Also remove from the state
                    setEdges((prev) => prev.filter((e) => e.data.id !== edge.id()));
                });
                connectedEdges.remove();
            }
            element.remove();

            // Update the state
            if (isNode) {
                setNodes((prev) => prev.filter((node) => node.data.id !== elementId));
            } else {
                setEdges((prev) => prev.filter((edge) => edge.data.id !== elementId));
            }

            // Clear the selection
            setSelectedNode(null);
            setSelectedEdge(null);
        }
    };

    // Render the toolbar
    const renderToolbar = () => (
        <div className="p-4 bg-gray-100 flex flex-wrap items-center gap-4 border-b">
            {title && (
                <div className="flex items-center gap-2">
                    <span className="text-base font-thin">Architecture:</span>
                    <span className="text-base font-semibold">{title}</span>
                </div>
            )}
            <button
                onClick={addNode}
                className="btn btn-primary flex items-center gap-2"
                aria-label="Add Node"
            >
                <IoAddOutline /> Add Node
            </button>
            <button
                onClick={saveJSON}
                className="btn btn-success flex items-center gap-2"
                aria-label="Save JSON"
            >
                <IoSaveOutline /> Save JSON
            </button>
            {isInEdgeCreationMode && (
                <div className="ml-auto text-blue-600 font-semibold flex items-center">
                    Edge Creation Mode
                    <button
                        onClick={() => {
                            setEdgeCreationSource(null);
                            setIsInEdgeCreationMode(false);
                        }}
                        className="ml-2 btn btn-sm btn-outline btn-error"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );

    // Initialize Cytoscape instance
    useEffect(() => {
        const container = cyRef.current;
        if (!container) return;

        if (cy) {
            cy.destroy();
        }

        console.log('Initializing with nodes:', initialNodes);

        const nodesWithClass = initialNodes.map((node) => ({
            ...node,
            classes: node.classes ? `${node.classes} node` : 'node',
        }));

        const cytoscapeInstance = cytoscape({
            container: container,
            elements: [...nodesWithClass, ...initialEdges],
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
                        label: isNodeDescActive ? 'data(_displayPlaceholderWithDesc)' : 'data(_displayPlaceholderWithoutDesc)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-max-width': '180px',
                        "font-family": 'Arial',
                        width: '200px',
                        height: 'label',
                        shape: 'rectangle',
                        'background-color': '#f5f5f5',
                        'text-background-opacity': 0,
                        'border-width': 1,
                        'border-color': '#cccccc',
                    },
                },
                {
                    selector: ':parent',
                    style: {
                        label: 'data(label)',
                    },
                },
                {
                    selector: 'node.shell-node',
                    style: {
                        width: '200px',
                        height: '100px',
                        'background-opacity': 0,
                        'border-width': 0,
                    },
                },
            ],
            layout: breadthFirstLayout,
            boxSelectionEnabled: true,
            minZoom: 0.1,
            maxZoom: 5,
        });

        setCy(cytoscapeInstance);
        setNodes(nodesWithClass);
        setEdges(initialEdges);

        cytoscapeInstance.batch(() => {
            cytoscapeInstance.nodes().forEach((node) => {
                node.addClass('node');
            });
        });

        // Set up event handlers
        cytoscapeInstance.on('tap', 'node', (e: EventObject) => {
            const node = e.target;
            const nodeData = node.data();

            // Handle edge creation mode
            if (isInEdgeCreationMode && edgeCreationSource && edgeCreationSource !== nodeData.id) {
                const newEdgeId = `edge-${Date.now()}`;
                const newEdge = {
                    data: {
                        id: newEdgeId,
                        source: edgeCreationSource,
                        target: nodeData.id,
                        label: 'New Connection',
                        isShell: true, // Mark as shell to enter edit mode
                    },
                };

                // Add to cytoscape
                cytoscapeInstance.add({
                    group: 'edges',
                    data: newEdge.data,
                });

                // Add to state
                setEdges((prev) => [...prev, newEdge]);

                // Reset edge creation mode
                setEdgeCreationSource(null);
                setIsInEdgeCreationMode(false);

                // Select the new edge for editing
                setSelectedNode(null);
                setSelectedEdge(newEdge.data);
                return;
            }

            // Normal node selection
            setSelectedNode(nodeData);
            setSelectedEdge(null);
        });

        cytoscapeInstance.on('tap', 'edge', (e: EventObject) => {
            const edge = e.target;
            setSelectedEdge(edge.data());
            setSelectedNode(null);
            setEdgeCreationSource(null);
            setIsInEdgeCreationMode(false);
        });

        cytoscapeInstance.on('tap', (e: EventObject) => {
            if (e.target === cytoscapeInstance) {
                // Clicked on background
                setSelectedNode(null);
                setSelectedEdge(null);


                // Only cancel edge creation when click on background is detected
                if (isInEdgeCreationMode) {
                    setEdgeCreationSource(null);
                    setIsInEdgeCreationMode(false);
                }
            }
        });

        // Update node labels dynamically
        /* eslint-disable @typescript-eslint/no-explicit-any */
        (cytoscapeInstance as Core & { nodeHtmlLabel: any }).nodeHtmlLabel([
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

        cytoscapeInstance.on('zoom', () => {
            updateZoom(cytoscapeInstance.zoom());
        });

        // Apply HTML labels after a short delay to ensure nodes are ready
        setTimeout(() => {
            console.log('Running initial refresh of node labels');
            refreshNodeLabels();
        }, 100);

        return () => {
            if (cytoscapeInstance) {
                cytoscapeInstance.destroy();
            }
        };
    }, [initialNodes, initialEdges, isInEdgeCreationMode, edgeCreationSource, updateZoom]);

    // Synchronize zoom level with context
    useEffect(() => {
        if (cy && cy.zoom() !== zoomLevel) {
            cy.zoom(zoomLevel);
        }
    }, [cy, zoomLevel]);

    // Refresh labels when visibility changes or selection changes
    useEffect(() => {
        if (cy) {
            console.log('Selection or visibility changed, refreshing labels');
            refreshNodeLabels();
        }
    }, [isNodeDescActive, isConDescActive, selectedNode, selectedEdge, cy]);

    return (
        <div className="relative flex flex-col">
            {renderToolbar()}
            <div className="flex flex-1 relative">
                <div
                    ref={cyRef}
                    className="flex-1 bg-white visualizer"
                    style={{
                        height: 'calc(100vh - 200px)',
                    }}
                />
                {(selectedNode || selectedEdge) && (
                    <div className="absolute right-0">
                        <Sidebar
                            selectedData={
                                selectedNode || (selectedEdge as Node['data'] | Edge['data'])
                            }
                            closeSidebar={() => {
                                setSelectedNode(null);
                                setSelectedEdge(null);
                            }}
                            updateElement={updateElement}
                            deleteElement={deleteElement}
                            nodes={nodes}
                            createEdge={(sourceId, targetId, label) => {
                                if (cy && sourceId && targetId) {
                                    const newEdgeId = `edge-${Date.now()}`;
                                    const newEdge = {
                                        id: newEdgeId,
                                        source: sourceId,
                                        target: targetId,
                                        label: label || 'New Connection',
                                        isShell: false,
                                    };

                                    // Add to the cytoscape instance
                                    cy.add({
                                        group: 'edges',
                                        data: newEdge,
                                    });

                                    // Add to the state
                                    setEdges((prev) => [...prev, { data: newEdge }]);

                                    // Select the new edge for editing
                                    setSelectedNode(null);
                                    setSelectedEdge(newEdge);
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
