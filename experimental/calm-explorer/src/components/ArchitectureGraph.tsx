import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { Card } from "./ui/card";
import { Network, AlertCircle, ExternalLink, FileText } from "lucide-react";
import { Alert, AlertDescription } from "./ui/alert";
import { FloatingEdge } from "./FloatingEdge";
import { CustomNode } from "./CustomNode";
import { SystemGroupNode } from "./SystemGroupNode";
import { extractId } from "@/utils/calmHelpers";
import { GRAPH_LAYOUT } from "@/utils/constants";

interface ArchitectureGraphProps {
  jsonData: any;
  onNodeClick: (node: any) => void;
  onEdgeClick?: (edge: any) => void;
  onJumpToControl?: (controlId: string) => void;
  onJumpToNode?: (nodeId: string) => void;
}

const expandOptionsRelationships = (data: any) => {
  if (!data || !data.relationships) {
    console.log('expandOptionsRelationships: No data or relationships');
    return data;
  }

  console.log('expandOptionsRelationships: Starting with', data.relationships.length, 'relationships');

  const expandedData = { ...data };
  const nodesToAdd: any[] = [];
  const relationshipsToAdd: any[] = [];
  const relationshipsToRemove: string[] = [];

  // Find all options relationships and expand them
  data.relationships.forEach((rel: any) => {
    const options = rel["relationship-type"]?.options;

    if (options && Array.isArray(options)) {
      console.log('Found options relationship:', rel["unique-id"], 'with', options.length, 'options');

      // Mark this relationship for removal since we're expanding it
      relationshipsToRemove.push(rel["unique-id"]);

      // For now, expand all options (or we could let user select which option)
      options.forEach((option: any, idx: number) => {
        console.log(`  Option ${idx}: ${option.description}`);

        // Get node IDs referenced by this option
        const optionNodeIds = option.nodes || [];
        console.log(`    - ${optionNodeIds.length} node references:`, optionNodeIds.slice(0, 3));

        // Get relationship IDs referenced by this option
        const optionRelationshipIds = option.relationships || [];
        console.log(`    - ${optionRelationshipIds.length} relationship references:`, optionRelationshipIds.slice(0, 3));

        // Find the actual node definitions and add them if they exist
        const nodesData = data.nodes || [];
        optionNodeIds.forEach((nodeId: string) => {
          const node = nodesData.find((n: any) =>
            (n["unique-id"] || n.unique_id || n.id) === nodeId
          );
          if (node && !nodesToAdd.some(n => (n["unique-id"] || n.unique_id || n.id) === nodeId)) {
            nodesToAdd.push(node);
          }
        });

        // Find the actual relationship definitions and add them
        optionRelationshipIds.forEach((relId: string) => {
          const relationship = data.relationships.find((r: any) =>
            (r["unique-id"] || r.unique_id || r.id) === relId
          );
          if (relationship && !relationshipsToAdd.some(r => (r["unique-id"] || r.unique_id || r.id) === relId)) {
            relationshipsToAdd.push(relationship);
          }
        });
      });
    }
  });

  console.log('expandOptionsRelationships: Found', nodesToAdd.length, 'nodes to add');
  console.log('expandOptionsRelationships: Found', relationshipsToAdd.length, 'relationships to add');
  console.log('expandOptionsRelationships: Removing', relationshipsToRemove.length, 'options relationships');

  // Create a set of existing node IDs to avoid duplicates
  const existingNodeIds = new Set(
    (data.nodes || []).map((n: any) => n["unique-id"] || n.unique_id || n.id)
  );

  // Add nodes that aren't already in the main nodes array
  const newNodes = [...(data.nodes || [])];
  nodesToAdd.forEach(node => {
    const nodeId = node["unique-id"] || node.unique_id || node.id;
    if (!existingNodeIds.has(nodeId)) {
      newNodes.push(node);
    }
  });

  // Filter out options relationships and add the expanded relationships
  const newRelationships = (data.relationships || [])
    .filter((r: any) => !relationshipsToRemove.includes(r["unique-id"]))
    .concat(relationshipsToAdd);

  console.log('expandOptionsRelationships: Result -', newNodes.length, 'nodes,', newRelationships.length, 'relationships');

  return {
    ...expandedData,
    nodes: newNodes,
    relationships: newRelationships
  };
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = GRAPH_LAYOUT.NODE_WIDTH;
  const nodeHeight = GRAPH_LAYOUT.NODE_HEIGHT;

  dagreGraph.setGraph({
    rankdir: 'LR',
    ranksep: GRAPH_LAYOUT.RANK_SEPARATION,
    nodesep: GRAPH_LAYOUT.NODE_SEPARATION,
    edgesep: GRAPH_LAYOUT.EDGE_SEPARATION,
    marginx: GRAPH_LAYOUT.MARGIN_X,
    marginy: GRAPH_LAYOUT.MARGIN_Y,
    ranker: 'longest-path' // Use longest-path ranker for better alignment
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const ArchitectureGraph = ({ jsonData, onNodeClick, onEdgeClick, onJumpToControl, onJumpToNode }: ArchitectureGraphProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const edgeTypes = useMemo(() => ({ custom: FloatingEdge }), []);
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: SystemGroupNode }), []);

  const parseCALMData = useCallback((data: any, onShowDetailsCallback?: (nodeData: any) => void, onJumpToControlCallback?: (controlId: string) => void) => {
    if (!data) return { nodes: [], edges: [] };

    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const systemNodes: Node[] = [];
    const deploymentMap: Record<string, string[]> = {}; // systemId -> [childNodeIds]

    try {
      // Pre-process options relationships to expand pattern nodes/relationships
      const expandedData = expandOptionsRelationships(data);

      // First pass: identify container nodes and build parent-child map from relationships
      const containerNodeIds = new Set<string>();
      const parentMap = new Map<string, string>(); // childId -> parentId
      const relationships = expandedData.relationships || [];

      relationships.forEach((rel: any) => {
        if (rel["relationship-type"]?.["deployed-in"]) {
          const containerId = rel["relationship-type"]["deployed-in"].container;
          const childNodeIds = rel["relationship-type"]["deployed-in"].nodes || [];
          if (containerId) {
            containerNodeIds.add(containerId);
            // Map each child to its parent
            childNodeIds.forEach((childId: string) => {
              parentMap.set(childId, containerId);
            });
          }
        }
        if (rel["relationship-type"]?.["composed-of"]) {
          const containerId = rel["relationship-type"]["composed-of"].container;
          const childNodeIds = rel["relationship-type"]["composed-of"].nodes || [];
          if (containerId) {
            containerNodeIds.add(containerId);
            // Map each child to its parent
            childNodeIds.forEach((childId: string) => {
              parentMap.set(childId, containerId);
            });
          }
        }
      });

      console.log('parseCALMData: Found', containerNodeIds.size, 'container nodes:', Array.from(containerNodeIds));
      console.log('parseCALMData: Parent map:', Object.fromEntries(parentMap));

      // Parse nodes from CALM structure - handle both array and object formats
      const nodesData = expandedData.nodes || [];
      console.log('parseCALMData: Processing', nodesData.length, 'nodes');

      if (Array.isArray(nodesData)) {
        // Handle FINOS CALM array format
        nodesData.forEach((node: any) => {
          const id = node["unique-id"] || node.unique_id || node.id;
          const nodeType = node["node-type"] || node.node_type || node.type;

          if (id) {
            // Treat as system node if it's declared as "system" OR if it's used as a container
            const isContainer = containerNodeIds.has(id);
            const isSystemNode = nodeType === "system" || isContainer;

            if (isSystemNode) {
              const parentId = parentMap.get(id);
              const systemNode: any = {
                id,
                type: "group",
                position: { x: 0, y: 0 },
                style: {
                  zIndex: -1,
                },
                data: {
                  label: node.name || id,
                  nodeType: nodeType || "system",
                  ...node
                },
              };
              // If this system node has a parent, set it
              if (parentId) {
                systemNode.parentId = parentId;
                systemNode.expandParent = true;
              }
              systemNodes.push(systemNode);
            } else {
              const parentId = parentMap.get(id);
              const regularNode: any = {
                id,
                type: "custom",
                position: { x: 0, y: 0 },
                data: {
                  label: node.name || id,
                  ...node,
                  onShowDetails: onShowDetailsCallback,
                  onJumpToControl: onJumpToControlCallback
                }
              };
              // If this regular node has a parent, set it
              if (parentId) {
                regularNode.parentId = parentId;
                regularNode.expandParent = true;
              }
              newNodes.push(regularNode);
            }
          }
        });
        console.log('parseCALMData: Created', newNodes.length, 'regular nodes and', systemNodes.length, 'system nodes');
      } else {
        // Handle object format
        Object.entries(nodesData).forEach(([id, node]: [string, any]) => {
          const nodeType = (node as any)["node-type"] || (node as any).node_type || (node as any).type;

          // Treat as system node if it's declared as "system" OR if it's used as a container
          const isContainer = containerNodeIds.has(id);
          const isSystemNode = nodeType === "system" || isContainer;

          if (isSystemNode) {
            const parentId = parentMap.get(id);
            const systemNode: any = {
              id,
              type: "group",
              position: { x: 0, y: 0 },
              style: {
                zIndex: -1,
              },
              data: {
                label: (node as any).name || (node as any).unique_id || id,
                nodeType: nodeType || "system",
                ...node
              },
            };
            // If this system node has a parent, set it
            if (parentId) {
              systemNode.parentId = parentId;
              systemNode.expandParent = true;
            }
            systemNodes.push(systemNode);
          } else {
            const parentId = parentMap.get(id);
            const regularNode: any = {
              id,
              type: "custom",
              position: { x: 0, y: 0 },
              data: {
                label: (node as any).name || (node as any).unique_id || id,
                ...node,
                onShowDetails: onShowDetailsCallback,
                onJumpToControl: onJumpToControlCallback
              }
            };
            // If this regular node has a parent, set it
            if (parentId) {
              regularNode.parentId = parentId;
              regularNode.expandParent = true;
            }
            newNodes.push(regularNode);
          }
        });
      }

      // Parse flows to identify bidirectional relationships
      const flows = expandedData.flows || [];
      const flowTransitions = new Map<string, Array<{sequence: number, direction: string, description: string, flowName: string}>>();

      flows.forEach((flow: any) => {
        const flowName = flow.name || 'Unnamed Flow';
        const transitions = flow.transitions || [];
        transitions.forEach((transition: any) => {
          const relId = transition['relationship-unique-id'];
          const direction = transition.direction || 'source-to-destination';
          const sequence = transition['sequence-number'] || transition.sequence_number || 0;
          const description = transition.description || '';

          if (!flowTransitions.has(relId)) {
            flowTransitions.set(relId, []);
          }
          flowTransitions.get(relId)!.push({ sequence, direction, description, flowName });
        });
      });

      // Parse relationships/edges - handle FINOS CALM nested format
      // Note: relationships already declared above for container detection
      console.log('parseCALMData: Processing', relationships.length, 'relationships');

      relationships.forEach((rel: any, index: number) => {
        // Check for deployed-in or composed-of relationships (both handle container-nodes)
        if (rel["relationship-type"]?.["deployed-in"] || rel["relationship-type"]?.["composed-of"]) {
          const containerRel = rel["relationship-type"]["deployed-in"] || rel["relationship-type"]["composed-of"];
          const containerId = containerRel.container;
          const childNodeIds = containerRel.nodes || [];

          if (containerId && childNodeIds.length > 0) {
            deploymentMap[containerId] = childNodeIds;
          }
        }
        // Handle interacts relationships (actor to multiple nodes)
        else if (rel["relationship-type"]?.interacts) {
          const interacts = rel["relationship-type"].interacts;
          const actorId = interacts.actor;
          const targetNodeIds = interacts.nodes || [];
          const label = rel.description || "interacts";

          // Create edges from actor to each target node
          targetNodeIds.forEach((targetId: string, targetIndex: number) => {
            newEdges.push({
              id: `edge-${index}-${targetIndex}`,
              source: actorId,
              target: targetId,
              sourceHandle: 'source',
              targetHandle: 'target',
              type: "custom",
              animated: false, // Non-animated to distinguish from connects
              style: {
                stroke: "hsl(280 75% 60%)", // Purple for actor interactions
                strokeWidth: 2,
                strokeDasharray: "5,5", // Dashed line
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "hsl(280 75% 60%)",
                width: 25,
                height: 25,
              },
              data: {
                description: label,
                protocol: rel.protocol || "",
                metadata: rel.metadata || {},
                'unique-id': extractId(rel),
                relationshipType: 'interacts'
              }
            });
          });
        }
        // Handle regular connections
        else if (rel["relationship-type"]?.connects) {
          const connects = rel["relationship-type"].connects;
          const sourceId = connects.source?.node;
          const targetId = connects.destination?.node;
          const label = rel.description || rel.protocol || "";
          const relId = extractId(rel);

          if (sourceId && targetId) {
            // Check if this relationship has flow transitions
            const transitions = flowTransitions.get(relId) || [];

            // Group transitions by direction
            const forwardTransitions = transitions.filter(t => t.direction === 'source-to-destination');
            const backwardTransitions = transitions.filter(t => t.direction === 'destination-to-source');

            // If we have bidirectional flow, create two parallel edges (both same direction)
            if (forwardTransitions.length > 0 && backwardTransitions.length > 0) {
              // Forward edge (request) - solid line with arrow
              // Store edge data, positions will be calculated after layout
              newEdges.push({
                id: `edge-${index}-forward`,
                source: sourceId,
                target: targetId,
                sourceHandle: 'source',
                targetHandle: 'target',
                type: "custom",
                animated: true,
                style: {
                  stroke: "hsl(var(--accent))",
                  strokeWidth: 2.5
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "hsl(var(--accent))",
                  width: 25,
                  height: 25,
                },
                data: {
                  description: label,
                  protocol: rel.protocol || "",
                  metadata: rel.metadata || {},
                  'unique-id': relId,
                  flowTransitions: forwardTransitions,
                  direction: 'forward',
                  controls: rel.controls
                }
              });

              // Backward edge (response) - dashed line with arrow pointing BACK to source
              // Store edge data, positions will be calculated after layout
              newEdges.push({
                id: `edge-${index}-backward`,
                source: sourceId,
                target: targetId,
                sourceHandle: 'source',
                targetHandle: 'target',
                type: "custom",
                animated: true,
                style: {
                  stroke: "hsl(280 75% 60%)", // Purple for return flow
                  strokeWidth: 2.5,
                  strokeDasharray: "5,5", // Dashed to distinguish from request
                  animationDirection: 'reverse' // Reverse the animation direction
                },
                markerStart: {
                  type: MarkerType.ArrowClosed,
                  color: "hsl(280 75% 60%)",
                  width: 25,
                  height: 25,
                  orient: 'auto-start-reverse' as any
                },
                data: {
                  description: label,
                  protocol: rel.protocol || "",
                  metadata: rel.metadata || {},
                  'unique-id': relId,
                  flowTransitions: backwardTransitions,
                  direction: 'backward',
                  controls: rel.controls
                }
              });
            }
            // Single direction - create one edge
            else {
              newEdges.push({
                id: `edge-${index}`,
                source: sourceId,
                target: targetId,
                sourceHandle: 'source',
                targetHandle: 'target',
                type: "custom",
                animated: true,
                style: {
                  stroke: "hsl(var(--accent))",
                  strokeWidth: 2.5
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: "hsl(var(--accent))",
                  width: 25,
                  height: 25,
                },
                data: {
                  description: label,
                  protocol: rel.protocol || "",
                  metadata: rel.metadata || {},
                  'unique-id': relId,
                  flowTransitions: transitions,
                  controls: rel.controls
                }
              });
            }
          }
        }
        // Fallback to simple formats
        else {
          const sourceId = rel.source || rel.from || rel.source_id;
          const targetId = rel.target || rel.to || rel.target_id;
          const label = rel.relationship_type || rel.type || rel.label || "";

          if (sourceId && targetId) {
            newEdges.push({
              id: `edge-${index}`,
              source: sourceId,
              target: targetId,
              sourceHandle: 'source',
              targetHandle: 'target',
              type: "custom",
              animated: true,
              style: {
                stroke: "hsl(var(--accent))",
                strokeWidth: 2.5
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: "hsl(var(--accent))",
                width: 25,
                height: 25,
              },
              data: {
                description: label,
                protocol: rel.protocol || "",
                metadata: rel.metadata || {},
                'unique-id': extractId(rel)
              }
            });
          }
        }
      });

      console.log('parseCALMData: Created', newEdges.length, 'edges from relationships');

      // Separate nodes into groups based on parentId (already set during node creation)
      const nodesWithParents: Node[] = []; // All nodes (regular and system) that have parents
      const nodesWithoutParents: Node[] = []; // Top-level nodes only

      // Check regular nodes
      newNodes.forEach((node: any) => {
        if (node.parentId) {
          nodesWithParents.push(node);
        } else {
          nodesWithoutParents.push(node);
        }
      });

      // Check system nodes too - they can also have parents now!
      const topLevelSystemNodes: Node[] = [];
      const nestedSystemNodes: Node[] = [];
      systemNodes.forEach((node: any) => {
        if (node.parentId) {
          nodesWithParents.push(node);
          nestedSystemNodes.push(node);
        } else {
          nodesWithoutParents.push(node);
          topLevelSystemNodes.push(node);
        }
      });

      // Step 1: Layout children within each system
      systemNodes.forEach((systemNode) => {
        const childNodes = nodesWithParents.filter(n => n.parentId === systemNode.id);
        
        if (childNodes.length > 0) {
          // Get edges within this system
          const systemEdges = newEdges.filter(e => 
            childNodes.some(n => n.id === e.source) && 
            childNodes.some(n => n.id === e.target)
          );
          
          // Layout children with compact settings
          const { nodes: layoutedChildren } = getLayoutedElements(childNodes, systemEdges);
          
          // Calculate bounding box
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          const nodeWidth = GRAPH_LAYOUT.NODE_WIDTH;
          const nodeHeight = GRAPH_LAYOUT.NODE_HEIGHT;

          layoutedChildren.forEach(child => {
            minX = Math.min(minX, child.position.x);
            minY = Math.min(minY, child.position.y);
            maxX = Math.max(maxX, child.position.x + nodeWidth);
            maxY = Math.max(maxY, child.position.y + nodeHeight);
          });

          // Set system dimensions with padding
          const padding = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;
          const calculatedWidth = maxX - minX + padding * 2;
          const calculatedHeight = maxY - minY + padding * 2;

          // Set dimensions both in style (for CSS) and directly on node (for ReactFlow edge calculations)
          systemNode.width = calculatedWidth;
          systemNode.height = calculatedHeight;
          systemNode.style = {
            ...systemNode.style,
            width: calculatedWidth,
            height: calculatedHeight,
          };
          
          // Update child positions to be relative to system origin with padding
          layoutedChildren.forEach((child, idx) => {
            const originalChild = nodesWithParents.find(n => n.id === child.id);
            if (originalChild) {
              originalChild.position = {
                x: child.position.x - minX + padding,
                y: child.position.y - minY + padding
              };
            }
          });
        } else {
          // Empty system - set default dimensions
          const defaultWidth = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
          const defaultHeight = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;

          // Set dimensions both in style (for CSS) and directly on node (for ReactFlow edge calculations)
          systemNode.width = defaultWidth;
          systemNode.height = defaultHeight;
          systemNode.style = {
            ...systemNode.style,
            width: defaultWidth,
            height: defaultHeight,
          };
        }
      });

      // Step 2: Create top-level layout
      // For top-level layout, we only include top-level system nodes (those without parents)
      const systemNodesForLayout = topLevelSystemNodes.map(s => ({
        ...s,
        // These already don't have parentId set
      }));
      
      // Get edges that connect independent nodes or cross system boundaries
      const topLevelEdges = newEdges.filter(e => {
        const sourceInSystem = nodesWithParents.some(n => n.id === e.source);
        const targetInSystem = nodesWithParents.some(n => n.id === e.target);
        // Include edge if at least one end is independent or they're in different systems
        return !sourceInSystem || !targetInSystem;
      });
      
      // Combine independent nodes and top-level system nodes for top-level layout
      const topLevelNodes = [...nodesWithoutParents, ...systemNodesForLayout];
      
      // Layout with increased spacing to prevent overlap
      const dagreGraph = new dagre.graphlib.Graph();
      dagreGraph.setDefaultEdgeLabel(() => ({}));
      dagreGraph.setGraph({
        rankdir: 'LR',
        ranksep: GRAPH_LAYOUT.TOP_LEVEL_RANK_SEPARATION,
        nodesep: GRAPH_LAYOUT.TOP_LEVEL_NODE_SEPARATION,
        edgesep: GRAPH_LAYOUT.TOP_LEVEL_EDGE_SEPARATION,
        marginx: GRAPH_LAYOUT.TOP_LEVEL_MARGIN,
        marginy: GRAPH_LAYOUT.TOP_LEVEL_MARGIN
      });

      topLevelNodes.forEach((node) => {
        const width = node.style?.width || GRAPH_LAYOUT.NODE_WIDTH;
        const height = node.style?.height || GRAPH_LAYOUT.NODE_HEIGHT;
        dagreGraph.setNode(node.id, { width, height });
      });
      
      topLevelEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });
      
      dagre.layout(dagreGraph);
      
      // Apply top-level positions
      nodesWithoutParents.forEach(node => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const width = GRAPH_LAYOUT.NODE_WIDTH;
        const height = GRAPH_LAYOUT.NODE_HEIGHT;
        node.position = {
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2,
        };
      });

      // Apply positions only to top-level system nodes (nested ones get positioned relative to their parents)
      topLevelSystemNodes.forEach(systemNode => {
        const nodeWithPosition = dagreGraph.node(systemNode.id);
        const width = (systemNode.style?.width as number) || GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
        const height = (systemNode.style?.height as number) || GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;
        systemNode.position = {
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2,
        };
      });

      // Combine all nodes
      const allNodes = [...topLevelSystemNodes, ...nodesWithoutParents.filter(n => !systemNodes.includes(n)), ...nodesWithParents];

      console.log('parseCALMData: Final result -', allNodes.length, 'nodes,', newEdges.length, 'edges');
      console.log('parseCALMData: Node breakdown - Top-level systems:', topLevelSystemNodes.length, 'Nested systems:', nestedSystemNodes.length, 'Top-level regular:', nodesWithoutParents.filter(n => !systemNodes.includes(n)).length, 'With parents:', nodesWithParents.length);

      return { nodes: allNodes, edges: newEdges };
    } catch (error) {
      console.error("Error parsing CALM data:", error);
      return { nodes: [], edges: [] };
    }
  }, []);

  useEffect(() => {
    const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick, onJumpToControl);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
  }, [jsonData, parseCALMData, setNodes, setEdges, onNodeClick, onJumpToControl]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Jump to node definition in JSON editor
      if (onJumpToNode) {
        const nodeId = extractId(node.data) || node.id;
        onJumpToNode(nodeId);
      }
    },
    [onJumpToNode]
  );

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            zIndex: n.id === node.id && n.type !== 'group' ? 1000 : (n.type === 'group' ? -1 : 1),
          },
        }))
      );
    },
    [setNodes]
  );

  const handleNodeMouseLeave = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            zIndex: n.type === 'group' ? -1 : 1,
          },
        }))
      );
    },
    [setNodes]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge.data);
      }
    },
    [onEdgeClick]
  );

  const isEmpty = nodes.length === 0;
  const adrs = jsonData?.adrs || [];

  return (
    <Card className="h-full flex flex-col overflow-hidden border-border bg-card">
      <div className="flex items-center gap-2 p-4 border-b border-border">
        <Network className="w-4 h-4 text-accent" />
        <h2 className="font-semibold">Architecture Visualization</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          {nodes.length} nodes, {edges.length} connections
        </span>
      </div>

      {adrs.length > 0 && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-medium">Architecture Decision Records</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {adrs.map((adr: string, index: number) => (
              <a
                key={index}
                href={adr}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-background/60 hover:bg-accent/20 border border-border transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="truncate max-w-[300px]">{adr}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        {isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Upload or paste a valid FINOS CALM JSON file to visualize the architecture.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeMouseEnter={handleNodeMouseEnter}
            onNodeMouseLeave={handleNodeMouseLeave}
            onEdgeClick={handleEdgeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            attributionPosition="bottom-left"
          >
            <Background color="hsl(var(--muted-foreground))" gap={16} />
            <Controls className="bg-card border-border" />
            <MiniMap
              className="bg-card border-border"
              nodeColor="hsl(var(--primary))"
              maskColor="hsl(var(--background) / 0.8)"
            />
          </ReactFlow>
        )}
      </div>
    </Card>
  );
};
