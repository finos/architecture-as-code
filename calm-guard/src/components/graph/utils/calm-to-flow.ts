import type { Node, Edge } from '@xyflow/react';
import type { AnalysisInput } from '@/lib/calm/extractor';
import type { ArchitectureAnalysis } from '@/lib/agents/architecture-analyzer';
import type { RiskAssessment } from '@/lib/agents/risk-scorer';
import type { ComplianceStatus } from '@/components/graph/nodes/service-node';
import { getLayoutedElements } from './layout';

/**
 * Map CALM node-type to React Flow custom node type name.
 *
 * - service → 'service' (ServiceNode)
 * - database → 'database' (DatabaseNode)
 * - webclient → 'webclient' (WebClientNode)
 * - actor → 'actor' (ActorNode)
 * - system / ecosystem → 'system' (SystemNode)
 * - network / ldap / data-asset → 'default' (DefaultNode)
 */
function mapNodeType(calmNodeType: string): string {
  switch (calmNodeType) {
    case 'service':
      return 'service';
    case 'database':
      return 'database';
    case 'webclient':
      return 'webclient';
    case 'actor':
      return 'actor';
    case 'system':
    case 'ecosystem':
      return 'system';
    default:
      // network, ldap, data-asset
      return 'default';
  }
}

/**
 * Map risk level to compliance status for node coloring.
 *
 * - low risk → compliant (emerald border)
 * - medium risk → partial (amber border)
 * - high / critical risk → non-compliant (red border)
 */
function mapRiskToCompliance(riskLevel: string): ComplianceStatus {
  switch (riskLevel) {
    case 'low':
      return 'compliant';
    case 'medium':
      return 'partial';
    case 'high':
    case 'critical':
      return 'non-compliant';
    default:
      return 'unknown';
  }
}

/**
 * Transform CALM analysis data into React Flow nodes and edges.
 *
 * Algorithm:
 * 1. Convert CALM nodes → React Flow nodes with compliance status
 * 2. Convert connects/interacts relationships → React Flow edges with protocol labels
 * 3. If architectureAnalysis is available, add trust boundary parent nodes
 * 4. If riskAssessment is available, update node compliance colors
 * 5. Apply dagre LR auto-layout
 *
 * @param analysisInput - Extracted CALM data with nodes, relationships, flows
 * @param architectureAnalysis - AI-generated architecture analysis (nullable)
 * @param riskAssessment - AI-generated risk assessment (nullable)
 * @returns React Flow nodes and edges ready for rendering
 */
export function calmToFlow(
  analysisInput: AnalysisInput,
  architectureAnalysis: ArchitectureAnalysis | null,
  riskAssessment: RiskAssessment | null
): { nodes: Node[]; edges: Edge[] } {
  // =========================================================================
  // Step 1: Build compliance status map from risk assessment
  // =========================================================================
  const complianceMap = new Map<string, ComplianceStatus>();

  if (riskAssessment) {
    riskAssessment.nodeRiskMap.forEach((entry) => {
      complianceMap.set(entry.nodeId, mapRiskToCompliance(entry.riskLevel));
    });
  }

  // =========================================================================
  // Step 2: Create React Flow nodes from CALM nodes
  // =========================================================================
  const flowNodes: Node[] = analysisInput.nodes.map((calmNode) => ({
    id: calmNode['unique-id'],
    type: mapNodeType(calmNode['node-type']),
    position: { x: 0, y: 0 }, // dagre will set this
    data: {
      label: calmNode.name,
      description: calmNode.description,
      complianceStatus: complianceMap.get(calmNode['unique-id']) ?? 'unknown',
      nodeType: calmNode['node-type'],
    },
  }));

  // =========================================================================
  // Step 3: Create React Flow edges from CALM relationships
  // =========================================================================
  const flowEdges: Edge[] = [];

  analysisInput.relationships.forEach((rel) => {
    if (rel['relationship-type'] === 'connects') {
      flowEdges.push({
        id: rel['unique-id'],
        source: rel.connects.source.node,
        target: rel.connects.destination.node,
        type: 'protocol',
        data: { protocol: rel.protocol ?? '' },
        markerEnd: { type: 'arrowclosed' as const, color: '#475569' },
      });
    } else if (rel['relationship-type'] === 'interacts') {
      // One edge from actor to each target node
      rel.interacts.nodes.forEach((targetNodeId, index) => {
        flowEdges.push({
          id: `${rel['unique-id']}-${index}`,
          source: rel.interacts.actor,
          target: targetNodeId,
          type: 'protocol',
          data: { protocol: rel.protocol ?? '' },
          markerEnd: { type: 'arrowclosed' as const, color: '#475569' },
        });
      });
    }
    // Skip deployed-in and composed-of — handled as trust boundaries
  });

  // =========================================================================
  // Step 4: Create trust boundary parent nodes (if architectureAnalysis available)
  // =========================================================================

  // Track which nodes have been assigned a parent
  const nodeParentMap = new Map<string, string>();

  if (architectureAnalysis && architectureAnalysis.trustBoundaries.length > 0) {
    architectureAnalysis.trustBoundaries.forEach((boundary, index) => {
      const boundaryId = `trust-boundary-${index}-${boundary.name.toLowerCase().replace(/\s+/g, '-')}`;

      // Add parent group node (will be positioned by layout.ts after child layout)
      // Note: trust boundary nodes appear FIRST in the array (React Flow requirement)
      flowNodes.unshift({
        id: boundaryId,
        type: 'trustBoundary',
        position: { x: 0, y: 0 },
        data: {
          label: boundary.name,
          boundaryType: boundary.boundaryType,
        },
        style: { width: 200, height: 120 }, // layout.ts will override these
        zIndex: -1,
      });

      // Assign children to this parent
      boundary.nodeIds.forEach((nodeId) => {
        // Only assign if not already claimed by another boundary
        if (!nodeParentMap.has(nodeId)) {
          nodeParentMap.set(nodeId, boundaryId);
        }
      });
    });

    // Apply parentId and extent to child nodes
    flowNodes.forEach((node) => {
      const parentId = nodeParentMap.get(node.id);
      if (parentId) {
        node.parentId = parentId;
        node.extent = 'parent';
      }
    });
  }

  // =========================================================================
  // Step 5: Apply dagre auto-layout (LR direction)
  // =========================================================================
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    flowNodes,
    flowEdges,
    'LR'
  );

  return { nodes: layoutedNodes, edges: layoutedEdges };
}
