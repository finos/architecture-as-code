import { ArchitectureGraph } from './ArchitectureGraph';
import {
  CalmArchitectureSchema,
  CalmNodeSchema,
  CalmRelationshipSchema,
} from '../../../../../calm-models/src/types/core-types.js';

export interface ReactFlowVisualizerProps {
  calmData: CalmArchitectureSchema;
  onNodeClick?: (nodeData: CalmNodeSchema) => void;
  onEdgeClick?: (edgeData: CalmRelationshipSchema) => void;
  onBackgroundClick?: () => void;
}

/**
 * ReactFlow-based visualizer component
 * Replaces the Cytoscape-based VisualizerContainer
 */
export function ReactFlowVisualizer({
  calmData,
  onNodeClick,
  onEdgeClick,
  onBackgroundClick,
}: ReactFlowVisualizerProps) {
  const handleBackgroundClick = (event: React.MouseEvent) => {
    // Only trigger if clicking the background (not a node or edge)
    if ((event.target as HTMLElement).classList.contains('react-flow__pane')) {
      onBackgroundClick?.();
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
      data-testid="reactflow-visualizer"
      onClick={handleBackgroundClick}
    >
      <ArchitectureGraph
        jsonData={calmData}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
      />
    </div>
  );
}
