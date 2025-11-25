import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';
import { FloatingEdge } from './FloatingEdge';
import { CustomNode } from './CustomNode';
import { SystemGroupNode } from './SystemGroupNode';
import { extractId } from './utils/calmHelpers';
import { GRAPH_LAYOUT } from './utils/constants';
import { THEME } from './theme';
import {
  CalmArchitectureSchema,
  CalmNodeSchema,
  CalmRelationshipSchema,
} from '../../../../../calm-models/src/types/core-types.js';

interface ArchitectureGraphProps {
  jsonData: CalmArchitectureSchema;
  onNodeClick?: (node: CalmNodeSchema) => void;
  onEdgeClick?: (edge: CalmRelationshipSchema) => void;
}

// Flow transition type for tracking bidirectional flows
interface FlowTransition {
  sequence: number;
  direction: string;
  description: string;
  flowName: string;
}

// Edge configuration for creating consistent edges
interface EdgeConfig {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  animated?: boolean;
  dashed?: boolean;
  markerPosition?: 'end' | 'start';
  data: Record<string, unknown>;
}

/**
 * Creates a ReactFlow edge with consistent styling
 */
function createEdge(config: EdgeConfig): Edge {
  const { id, source, target, label, color, animated = true, dashed = false, markerPosition = 'end', data } = config;

  const edge: Edge = {
    id,
    source,
    target,
    sourceHandle: 'source',
    targetHandle: 'target',
    type: 'custom',
    animated,
    style: {
      stroke: color,
      strokeWidth: dashed ? 2 : 2.5,
      ...(dashed && { strokeDasharray: '5,5' }),
    },
    data: {
      id,
      source,
      target,
      label,
      description: label,
      ...data,
    },
  };

  if (markerPosition === 'end') {
    edge.markerEnd = {
      type: MarkerType.ArrowClosed,
      color,
      width: 25,
      height: 25,
    };
  } else {
    edge.markerStart = {
      type: MarkerType.ArrowClosed,
      color,
      width: 25,
      height: 25,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orient: 'auto-start-reverse' as any,
    };
  }

  return edge;
}

const expandOptionsRelationships = (data: CalmArchitectureSchema): CalmArchitectureSchema => {
  if (!data || !data.relationships) {
    return data;
  }

  const expandedData = { ...data };
  const nodesToAdd: CalmNodeSchema[] = [];
  const relationshipsToAdd: CalmRelationshipSchema[] = [];
  const relationshipsToRemove: string[] = [];

  // Find all options relationships and expand them
  data.relationships.forEach((rel) => {
    const options = rel['relationship-type']?.options;

    if (options && Array.isArray(options)) {
      // Mark this relationship for removal since we're expanding it
      relationshipsToRemove.push(rel['unique-id']);

      // For now, expand all options
      options.forEach((option) => {
        // Get node IDs referenced by this option
        const optionNodeIds = option.nodes || [];

        // Get relationship IDs referenced by this option
        const optionRelationshipIds = option.relationships || [];

        // Find the actual node definitions and add them if they exist
        const nodesData = data.nodes || [];
        optionNodeIds.forEach((nodeId: string) => {
          const node = nodesData.find((n) => n['unique-id'] === nodeId);
          if (node && !nodesToAdd.some((n) => n['unique-id'] === nodeId)) {
            nodesToAdd.push(node);
          }
        });

        // Find the actual relationship definitions and add them
        optionRelationshipIds.forEach((relId: string) => {
          const relationship = data.relationships?.find((r) => r['unique-id'] === relId);
          if (relationship && !relationshipsToAdd.some((r) => r['unique-id'] === relId)) {
            relationshipsToAdd.push(relationship);
          }
        });
      });
    }
  });

  // Create a set of existing node IDs to avoid duplicates
  const existingNodeIds = new Set((data.nodes || []).map((n) => n['unique-id']));

  // Add nodes that aren't already in the main nodes array
  const newNodes = [...(data.nodes || [])];
  nodesToAdd.forEach((node) => {
    if (!existingNodeIds.has(node['unique-id'])) {
      newNodes.push(node);
    }
  });

  // Filter out options relationships and add the expanded relationships
  const newRelationships = (data.relationships || [])
    .filter((r) => !relationshipsToRemove.includes(r['unique-id']))
    .concat(relationshipsToAdd);

  return {
    ...expandedData,
    nodes: newNodes,
    relationships: newRelationships,
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
    ranker: 'longest-path',
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

export const ArchitectureGraph = ({ jsonData, onNodeClick, onEdgeClick }: ArchitectureGraphProps) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const edgeTypes = useMemo(() => ({ custom: FloatingEdge }), []);
  const nodeTypes = useMemo(() => ({ custom: CustomNode, group: SystemGroupNode }), []);

  const parseCALMData = useCallback(
    (data: CalmArchitectureSchema, onShowDetailsCallback?: (nodeData: CalmNodeSchema) => void) => {
      if (!data) return { nodes: [], edges: [] };

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      const systemNodes: Node[] = [];
      const deploymentMap: Record<string, string[]> = {};

      try {
        // Pre-process options relationships to expand pattern nodes/relationships
        const expandedData = expandOptionsRelationships(data);

        // First pass: identify container nodes and build parent-child map from relationships
        const containerNodeIds = new Set<string>();
        const parentMap = new Map<string, string>();
        const relationships = expandedData.relationships || [];

        relationships.forEach((rel) => {
          if (rel['relationship-type']?.['deployed-in']) {
            const containerId = rel['relationship-type']['deployed-in'].container;
            const childNodeIds = rel['relationship-type']['deployed-in'].nodes || [];
            if (containerId) {
              containerNodeIds.add(containerId);
              childNodeIds.forEach((childId: string) => {
                parentMap.set(childId, containerId);
              });
            }
          }
          if (rel['relationship-type']?.['composed-of']) {
            const containerId = rel['relationship-type']['composed-of'].container;
            const childNodeIds = rel['relationship-type']['composed-of'].nodes || [];
            if (containerId) {
              containerNodeIds.add(containerId);
              childNodeIds.forEach((childId: string) => {
                parentMap.set(childId, containerId);
              });
            }
          }
        });

        // Parse nodes from CALM structure
        const nodesData = expandedData.nodes || [];

        if (Array.isArray(nodesData)) {
          nodesData.forEach((node) => {
            const id = node['unique-id'];
            const nodeType = node['node-type'];

            if (id) {
              const isContainer = containerNodeIds.has(id);
              const isSystemNode = nodeType === 'system' || isContainer;

              if (isSystemNode) {
                const parentId = parentMap.get(id);
                const systemNode: Node = {
                  id,
                  type: 'group',
                  position: { x: 0, y: 0 },
                  style: {
                    zIndex: -1,
                  },
                  data: {
                    // Include id and type for Sidebar compatibility
                    id,
                    type: nodeType || 'system',
                    label: node.name || id,
                    nodeType: nodeType || 'system',
                    ...node,
                  },
                  ...(parentId && { parentId, expandParent: true }),
                };
                systemNodes.push(systemNode);
              } else {
                const parentId = parentMap.get(id);
                const regularNode: Node = {
                  id,
                  type: 'custom',
                  position: { x: 0, y: 0 },
                  data: {
                    // Include id and type for Sidebar compatibility
                    id,
                    type: nodeType,
                    label: node.name || id,
                    ...node,
                    onShowDetails: onShowDetailsCallback,
                  },
                  ...(parentId && { parentId, expandParent: true }),
                };
                newNodes.push(regularNode);
              }
            }
          });
        }

        // Parse flows to identify bidirectional relationships
        const flows = expandedData.flows || [];
        const flowTransitions = new Map<string, FlowTransition[]>();

        flows.forEach((flow) => {
          const flowName = flow.name || 'Unnamed Flow';
          const transitions = flow.transitions || [];
          transitions.forEach((transition) => {
            const relId = transition['relationship-unique-id'];
            const direction = transition.direction || 'source-to-destination';
            const sequence = transition['sequence-number'] || 0;
            const description = transition.description || '';

            if (!flowTransitions.has(relId)) {
              flowTransitions.set(relId, []);
            }
            flowTransitions.get(relId)!.push({ sequence, direction, description, flowName });
          });
        });

        // Parse relationships/edges
        relationships.forEach((rel, index: number) => {
          // Check for deployed-in or composed-of relationships
          if (rel['relationship-type']?.['deployed-in'] || rel['relationship-type']?.['composed-of']) {
            const containerRel =
              rel['relationship-type']['deployed-in'] || rel['relationship-type']['composed-of'];

            if (containerRel) {
              const containerId = containerRel.container;
              const childNodeIds = containerRel.nodes || [];

              if (containerId && childNodeIds.length > 0) {
                deploymentMap[containerId] = childNodeIds;
              }
            }
          }
          // Handle interacts relationships
          else if (rel['relationship-type']?.interacts) {
            const interacts = rel['relationship-type'].interacts;
            const actorId = interacts.actor;
            const targetNodeIds = interacts.nodes || [];
            const label = rel.description || 'interacts';

            targetNodeIds.forEach((targetId: string, targetIndex: number) => {
              newEdges.push(createEdge({
                id: `edge-${index}-${targetIndex}`,
                source: actorId,
                target: targetId,
                label,
                color: THEME.colors.edge.interacts,
                animated: false,
                dashed: true,
                data: {
                  protocol: rel.protocol || '',
                  metadata: rel.metadata || {},
                  'unique-id': extractId(rel),
                  relationshipType: 'interacts',
                },
              }));
            });
          }
          // Handle regular connections
          else if (rel['relationship-type']?.connects) {
            const connects = rel['relationship-type'].connects;
            const sourceId = connects.source?.node;
            const targetId = connects.destination?.node;
            const label = rel.description || rel.protocol || '';
            const relId = extractId(rel);

            if (sourceId && targetId) {
              const transitions = flowTransitions.get(relId) || [];
              const forwardTransitions = transitions.filter(
                (t) => t.direction === 'source-to-destination'
              );
              const backwardTransitions = transitions.filter(
                (t) => t.direction === 'destination-to-source'
              );

              // Common edge data for this relationship
              const commonData = {
                protocol: rel.protocol || '',
                metadata: rel.metadata || {},
                'unique-id': relId,
                controls: rel.controls,
              };

              // If we have bidirectional flow, create two parallel edges
              if (forwardTransitions.length > 0 && backwardTransitions.length > 0) {
                // Forward edge
                newEdges.push(createEdge({
                  id: `edge-${index}-forward`,
                  source: sourceId,
                  target: targetId,
                  label,
                  color: THEME.colors.accent,
                  data: {
                    ...commonData,
                    flowTransitions: forwardTransitions,
                    direction: 'forward',
                  },
                }));

                // Backward edge
                newEdges.push(createEdge({
                  id: `edge-${index}-backward`,
                  source: sourceId,
                  target: targetId,
                  label,
                  color: THEME.colors.edge.backward,
                  dashed: true,
                  markerPosition: 'start',
                  data: {
                    ...commonData,
                    flowTransitions: backwardTransitions,
                    direction: 'backward',
                  },
                }));
              } else {
                // Single direction edge
                newEdges.push(createEdge({
                  id: `edge-${index}`,
                  source: sourceId,
                  target: targetId,
                  label,
                  color: THEME.colors.accent,
                  data: {
                    ...commonData,
                    flowTransitions: transitions,
                  },
                }));
              }
            }
          }
          // Unrecognized relationship type - skip
          // All valid CALM relationships should be handled above (deployed-in, composed-of, interacts, connects)
        });

        // Separate nodes into groups based on parentId
        const nodesWithParents: Node[] = [];
        const nodesWithoutParents: Node[] = [];

        newNodes.forEach((node) => {
          if (node.parentId) {
            nodesWithParents.push(node);
          } else {
            nodesWithoutParents.push(node);
          }
        });

        const topLevelSystemNodes: Node[] = [];
        const nestedSystemNodes: Node[] = [];
        systemNodes.forEach((node) => {
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
          const childNodes = nodesWithParents.filter((n) => n.parentId === systemNode.id);

          if (childNodes.length > 0) {
            const systemEdges = newEdges.filter(
              (e) =>
                childNodes.some((n) => n.id === e.source) && childNodes.some((n) => n.id === e.target)
            );

            const { nodes: layoutedChildren } = getLayoutedElements(childNodes, systemEdges);

            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity;
            const nodeWidth = GRAPH_LAYOUT.NODE_WIDTH;
            const nodeHeight = GRAPH_LAYOUT.NODE_HEIGHT;

            layoutedChildren.forEach((child) => {
              minX = Math.min(minX, child.position.x);
              minY = Math.min(minY, child.position.y);
              maxX = Math.max(maxX, child.position.x + nodeWidth);
              maxY = Math.max(maxY, child.position.y + nodeHeight);
            });

            const padding = GRAPH_LAYOUT.SYSTEM_NODE_PADDING;
            const calculatedWidth = maxX - minX + padding * 2;
            const calculatedHeight = maxY - minY + padding * 2;

            systemNode.width = calculatedWidth;
            systemNode.height = calculatedHeight;
            systemNode.style = {
              ...systemNode.style,
              width: calculatedWidth,
              height: calculatedHeight,
            };

            layoutedChildren.forEach((child) => {
              const originalChild = nodesWithParents.find((n) => n.id === child.id);
              if (originalChild) {
                originalChild.position = {
                  x: child.position.x - minX + padding,
                  y: child.position.y - minY + padding,
                };
              }
            });
          } else {
            const defaultWidth = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
            const defaultHeight = GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;

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
        const systemNodesForLayout = topLevelSystemNodes.map((s) => ({
          ...s,
        }));

        const topLevelEdges = newEdges.filter((e) => {
          const sourceInSystem = nodesWithParents.some((n) => n.id === e.source);
          const targetInSystem = nodesWithParents.some((n) => n.id === e.target);
          return !sourceInSystem || !targetInSystem;
        });

        const topLevelNodes = [...nodesWithoutParents, ...systemNodesForLayout];

        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({
          rankdir: 'LR',
          ranksep: GRAPH_LAYOUT.TOP_LEVEL_RANK_SEPARATION,
          nodesep: GRAPH_LAYOUT.TOP_LEVEL_NODE_SEPARATION,
          edgesep: GRAPH_LAYOUT.TOP_LEVEL_EDGE_SEPARATION,
          marginx: GRAPH_LAYOUT.TOP_LEVEL_MARGIN,
          marginy: GRAPH_LAYOUT.TOP_LEVEL_MARGIN,
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

        nodesWithoutParents.forEach((node) => {
          const nodeWithPosition = dagreGraph.node(node.id);
          const width = GRAPH_LAYOUT.NODE_WIDTH;
          const height = GRAPH_LAYOUT.NODE_HEIGHT;
          node.position = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          };
        });

        topLevelSystemNodes.forEach((systemNode) => {
          const nodeWithPosition = dagreGraph.node(systemNode.id);
          const width =
            (systemNode.style?.width as number) || GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_WIDTH;
          const height =
            (systemNode.style?.height as number) || GRAPH_LAYOUT.SYSTEM_NODE_DEFAULT_HEIGHT;
          systemNode.position = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          };
        });

        // Combine all nodes
        const allNodes = [
          ...topLevelSystemNodes,
          ...nodesWithoutParents.filter((n) => !systemNodes.includes(n)),
          ...nodesWithParents,
        ];

        return { nodes: allNodes, edges: newEdges };
      } catch (error) {
        console.error('Error parsing CALM data:', error);
        return { nodes: [], edges: [] };
      }
    },
    []
  );

  useEffect(() => {
    const { nodes: parsedNodes, edges: parsedEdges } = parseCALMData(jsonData, onNodeClick);
    setNodes(parsedNodes);
    setEdges(parsedEdges);
  }, [jsonData, parseCALMData, setNodes, setEdges, onNodeClick]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.data);
      }
    },
    [onNodeClick]
  );

  const handleNodeMouseEnter = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            zIndex: n.id === node.id && n.type !== 'group' ? 1000 : n.type === 'group' ? -1 : 1,
          },
        }))
      );
    },
    [setNodes]
  );

  const handleNodeMouseLeave = useCallback(
    () => {
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

  if (isEmpty) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: THEME.colors.background,
          color: THEME.colors.muted,
          fontSize: '14px',
        }}
      >
        <div
          style={{
            padding: '24px',
            background: THEME.colors.backgroundSecondary,
            borderRadius: '8px',
            border: `1px solid ${THEME.colors.border}`,
            maxWidth: '400px',
            textAlign: 'center',
          }}
        >
          No architecture data to display. Load a CALM architecture to visualize.
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%' }}>
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
        style={{ background: THEME.colors.background }}
      >
        <Background color={THEME.colors.border} gap={16} />
        <Controls
          style={{
            background: THEME.colors.card,
            border: `1px solid ${THEME.colors.border}`,
            borderRadius: '8px',
          }}
        />
        <MiniMap
          style={{
            background: THEME.colors.backgroundSecondary,
            border: `1px solid ${THEME.colors.border}`,
          }}
          nodeColor={THEME.colors.accent}
          maskColor={`${THEME.colors.background}cc`}
        />
      </ReactFlow>
    </div>
  );
};
