import { useState } from 'react';
import { ArchitectureGraph } from './ArchitectureGraph';
import { THEME } from './theme';
import {
  CalmArchitectureSchema,
  CalmNodeSchema,
  CalmRelationshipSchema,
} from '../../../../../calm-models/src/types/core-types.js';

export interface ReactFlowVisualizerProps {
  title: string;
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
  title,
  calmData,
  onNodeClick,
  onEdgeClick,
  onBackgroundClick,
}: ReactFlowVisualizerProps) {
  const [showNodeDescriptions, setShowNodeDescriptions] = useState(true);
  const [showEdgeDescriptions, setShowEdgeDescriptions] = useState(true);

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
    >
      {/* Control Panel */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          background: THEME.colors.card,
          border: `1px solid ${THEME.colors.border}`,
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: THEME.shadows.md,
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: THEME.colors.foreground,
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: `1px solid ${THEME.colors.border}`,
          }}
        >
          {title || 'Architecture Diagram'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: THEME.colors.foreground,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showNodeDescriptions}
              onChange={() => setShowNodeDescriptions(!showNodeDescriptions)}
              style={{ accentColor: THEME.colors.accent }}
            />
            Node descriptions
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: THEME.colors.foreground,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showEdgeDescriptions}
              onChange={() => setShowEdgeDescriptions(!showEdgeDescriptions)}
              style={{ accentColor: THEME.colors.accent }}
            />
            Connection descriptions
          </label>
        </div>
      </div>

      {/* Graph Container */}
      <div
        style={{ flex: 1, width: '100%', height: '100%', minHeight: 0 }}
        onClick={handleBackgroundClick}
      >
        <ArchitectureGraph
          jsonData={calmData}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
        />
      </div>
    </div>
  );
}
