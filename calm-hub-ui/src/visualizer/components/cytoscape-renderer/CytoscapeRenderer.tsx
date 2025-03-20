/* eslint-disable @typescript-eslint/no-unused-vars */
import './cytoscape.css';
import { useContext, useEffect, useRef, useState } from 'react';
import cytoscape, { Core, EdgeSingular, NodeSingular, EventObject } from 'cytoscape';
import nodeEdgeHtmlLabel from 'cytoscape-node-edge-html-label';
import expandCollapse from 'cytoscape-expand-collapse';
import Sidebar from '../sidebar/Sidebar.js';
import { ZoomContext } from '../zoom-context.provider.js';
import { IoAddOutline, IoSaveOutline } from 'react-icons/io5';

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

type NodeData = {
    description: string;
    type: string;
    label: string;
    id: string;
    isShell?: boolean;
    [idx: string]: string | boolean | undefined;
};

type EdgeData = {
    id: string;
    label: string;
    source: string;
    target: string;
    isShell?: boolean;
    [idx: string]: string | boolean | undefined;
};

export type Node = {
    classes?: string;
    data: NodeData;
};

export type Edge = {
    data: EdgeData;
};

interface Props {
    title?: string;
    isNodeDescActive: boolean;
    isConDescActive: boolean;
    nodes: Node[];
    edges: Edge[];
    onSaveData?: (nodes: Node[], edges: Edge[]) => void;
}

const CytoscapeRenderer = ({
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
    const [selectedElement, setSelectedElement] = useState<NodeData | EdgeData | null>(null);
    const [edgeCreationSource, setEdgeCreationSource] = useState<string | null>(null);

    // local state for nodes and edges to track changes
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    const [isInEdgeCreationMode, setIsInEdgeCreationMode] = useState(false);

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
            box-shadow: 0 0 10px rgba(0
        `;
        document.head.appendChild(styleTag);

        return () => {
            document.head.removeChild(styleTag);
        };
    }, []);

    function getNodeLabelTemplateGenerator(): (data: NodeData) => string {
        return (data: NodeData) => {
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
                return `<div class="node element data-id="${data.id}"">
                <p class="title" style="margin: 0; font-weight: bold;">${data.label}</p>
                      <p class="type" style="margin: 2px 0;">${data.type}</p>
                      <p class="description" style="margin: 2px 0;">${isNodeDescActive ? data.description : ''}</p>
                    </div>`;
            }
        };
    }
    const refreshNodeLabels = () => {
        if (cy) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (cy as Core & { nodeHtmlLabel: any }).nodeHtmlLabel([
                {
                    query: 'node',
                    tpl: getNodeLabelTemplateGenerator(),
                    halign: 'center',
                    valign: 'center',
                    halignBox: 'center',
                    valignBox: 'center',
                },
            ]);
        }
    };

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
                        setSelectedElement(node.data());
                    }
                }
            }
        };

        document.addEventListener('click', handleDocumentClick);
        return () => document.removeEventListener('click', handleDocumentClick);
    }, [cy]);

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

            setNodes((prev) => [...prev, { data: shellNodeData }]);

            cy.add({
                group: 'nodes',
                data: shellNodeData,
                position: { x: 300, y: 300 },
            });

            cy.layout(breadthFirstLayout).run();

         
                refreshNodeLabels();
                setSelectedElement(shellNodeData);
      
        }
    };

    const saveJSON = () => {
        if (cy) {
            // Get only the nodes and edges that still exist in the Cytoscape instance
            const currentNodeIds = new Set(cy.nodes().map(node => node.id()));
            const currentEdgeIds = new Set(cy.edges().map(edge => edge.id()));
            
            // Filter nodes that still exist and aren't shell nodes
            const formattedNodes = nodes
                .filter(node => currentNodeIds.has(node.data.id) && !node.data.isShell)
                .map((node: Node) => ({
                    'unique-id': node.data.id,
                    'node-type': node.data.type || '',
                    name: node.data.label || '',
                    description: node.data.description || '',
                    interfaces: [],
                }));

            // Filter edges that still exist and aren't shell edges
            const formattedRelationships = edges
                .filter(edge => currentEdgeIds.has(edge.data.id) && !edge.data.isShell)
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

    const updateElement = (updatedData: NodeData | EdgeData) => {
        if (!cy) return;

        // Check if this is an existing element
        const originalElement = cy.getElementById(selectedElement?.id || '');
        if (originalElement.length === 0) return;
        
        const finalData = { ...updatedData };
        
        // Handle shell status
        if (finalData.isShell) {
            finalData.isShell = false;
        }

        // Check if ID changed when new node was being edited
        const idChanged = selectedElement?.id !== finalData.id;
        
        if (idChanged && 'type' in finalData) {  
            // Create new node with new ID
            cy.add({
                group: 'nodes',
                data: finalData,
                position: originalElement.position()
            });
            
            // Update edges that reference this node
            cy.edges().forEach(edge => {
                const edgeData = edge.data();
                let changed = false;
                
                if (edgeData.source === selectedElement!.id) {
                    edgeData.source = finalData.id;
                    changed = true;
                }
                
                if (edgeData.target === selectedElement!.id) {
                    edgeData.target = finalData.id;
                    changed = true;
                }
                
                if (changed) {
                    edge.data(edgeData);
                    
                    // Update state for edges
                    setEdges(prev => 
                        prev.map(e => 
                            e.data.id === edgeData.id 
                                ? { ...e, data: { ...edgeData } } 
                                : e
                        )
                    );
                }
            });
            
            // Remove old node
            originalElement.remove();
            
            // Update state for nodes
            setNodes(prev => 
                prev.map(node => 
                    node.data.id === selectedElement!.id 
                        ? { ...node, data: finalData as NodeData } 
                        : node
                )
            );
            
            // Update selected element for sidebar
            setSelectedElement(finalData);
        } else {
            // Normal update (the new node ID wasn't changed)
            originalElement.data(finalData);
            
            if ('type' in finalData) {
                setNodes(prev => 
                    prev.map(node => 
                        node.data.id === finalData.id 
                            ? { ...node, data: finalData as NodeData } 
                            : node
                    )
                );
            } else if ('source' in finalData && 'target' in finalData) {
                setEdges(prev => 
                    prev.map(edge => 
                        edge.data.id === finalData.id 
                            ? { ...edge, data: finalData as EdgeData } 
                            : edge
                    )
                );
            }
            
            setSelectedElement(finalData);
        }
        
        // Always refresh node labels after an update
        setTimeout(() => {
            refreshNodeLabels();
        }, 100);
    };


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
                connectedEdges.forEach(edge => {
                    // Also remove from the state
                    setEdges(prev => prev.filter(e => e.data.id !== edge.id()));
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
            setSelectedElement(null);
        }
    };

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
                    tpl: getNodeLabelTemplateGenerator(),
                },
                {
                    query: '.node:selected',
                    tpl: getNodeLabelTemplateGenerator(),
                },
            ]);

            cy.on('tap', 'node', (e: EventObject) => {
                e.preventDefault();
                const node = e.target;
                const nodeData = node.data();
                if (edgeCreationSource && edgeCreationSource !== nodeData.id) {
                    // Create edge from edgeCreationSource to this node
                    const newEdgeId = `edge-${Date.now()}`;
                    const newEdge = {
                        id: newEdgeId,
                        source: edgeCreationSource,
                        target: nodeData.id,
                        label: 'New Connection',
                        isShell: true,
                    };
                    
                    // Add to the cytoscape instance
                    cy.add({
                        group: 'edges',
                        data: newEdge,
                    });
                    
                    // Add to the state
                    setEdges(prev => [...prev, { data: newEdge }]);
                    
                    // Reset the edge creation mode
                    setEdgeCreationSource(null);
                    setIsInEdgeCreationMode(false);
                    
                    // Select the new edge for editing
                    setSelectedElement(newEdge);
                    return;
                }
                setSelectedElement(nodeData);
            });

            cy.on('tap', 'edge', (e: EventObject) => {
                e.preventDefault();
                setEdgeCreationSource(null);
                setSelectedElement(e.target.data()); // Update state with the clicked node's data
            });

            cy.on('zoom', () => updateZoom(cy.zoom()));
        }
    }, [cy, zoomLevel, updateZoom, isNodeDescActive]);

    useEffect(() => {
        // Initialize Cytoscape instance
        const container = cyRef.current;

        if (!container) return;

        if (cy) {
            cy.destroy();
        }

        const cytoscapeInstance = cytoscape({
            container: container, // container to render
            elements: [...initialNodes, ...initialEdges], // graph data
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
                        'background-opacity': 0,
                        'border-width': 0,
                        'background-color': 'transparent',
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
        });

        setCy(cytoscapeInstance);
        setNodes(initialNodes);
        setEdges(initialEdges);

        cytoscapeInstance.on('tap', 'node', (e: EventObject) => {
            const node = e.target;
            const nodeData = node.data();

            //Handle edge creation mode
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
                setSelectedElement(newEdge.data);
                return;
            }

            // Normal node selection
            setSelectedElement(nodeData);
        });

        cytoscapeInstance.on('tap', 'edge', (e:EventObject) => {
            const edge = e.target;
            setSelectedElement(edge.data());
            setEdgeCreationSource(null);
            setIsInEdgeCreationMode(false);
        });

        cytoscapeInstance.on('tap', (e: EventObject) => {
            if (e.target === cytoscapeInstance) {
                // Clicked on background
                setSelectedElement(null);

                // Only cancel edge creation when click on background is detected
                if (isInEdgeCreationMode) {
                    setEdgeCreationSource(null);
                    setIsInEdgeCreationMode(false);
                }
            }
        });

        cytoscapeInstance.on('zoom', () => {
            updateZoom(cytoscapeInstance.zoom());
        });

        //Apply HTML labels
        setTimeout(() => {
            refreshNodeLabels();
        }, 100);

        return () => {
            if (cytoscapeInstance) {
                cytoscapeInstance.destroy();
            }
        };
    }, [initialNodes, initialEdges]); //Only run on initial nodes/edges change


    // refresh labels when visibility changes
    useEffect(() => {
        refreshNodeLabels();
    }, [isNodeDescActive, isConDescActive]);

    useEffect(() => {
        //Ensure cytoscape zoom and context state are synchronised
        if (cy?.zoom() !== zoomLevel) {
            cy?.zoom(zoomLevel);
        }
    }, [zoomLevel]);

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
                {selectedElement && (
                    <div className="absolute right-0">
                       <Sidebar
                            selectedData={selectedElement}
                            closeSidebar={() => setSelectedElement(null)}
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
                                    setEdges(prev => [...prev, { data: newEdge }]);
                                    
                                    // Select the new edge for editing
                                    setSelectedElement(newEdge);
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CytoscapeRenderer;
