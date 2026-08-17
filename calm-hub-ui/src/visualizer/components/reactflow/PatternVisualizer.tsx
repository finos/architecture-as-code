import { PatternGraph } from './PatternGraph.js';
import type { StoredNodePosition } from '../../services/node-position-service.js';

export interface PatternVisualizerProps {
    patternData: Record<string, unknown>;
    onNodeClick?: (nodeData: Record<string, unknown>) => void;
    onEdgeClick?: (edgeData: Record<string, unknown>) => void;
    onBackgroundClick?: () => void;
    /** Identifies the diagram (namespace/id) so its viewport can be remembered. */
    viewportKey?: string;
    /** Server-stored default layout for a pattern. undefined = loading, null = none stored. */
    defaultLayout?: StoredNodePosition[] | null;
    /** Bumped to force a clean re-apply of positions (used by "reset to default"). */
    layoutEpoch?: number;
    onPositionsChange?: (positions: StoredNodePosition[]) => void;
}

export function PatternVisualizer({
    patternData,
    onNodeClick,
    onEdgeClick,
    onBackgroundClick,
    viewportKey,
    defaultLayout,
    layoutEpoch,
    onPositionsChange,
}: PatternVisualizerProps) {
    const handleBackgroundClick = (event: React.MouseEvent) => {
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
            data-testid="pattern-visualizer"
            onClick={handleBackgroundClick}
        >
            <PatternGraph
                patternData={patternData}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                viewportKey={viewportKey}
                defaultLayout={defaultLayout}
                layoutEpoch={layoutEpoch}
                onPositionsChange={onPositionsChange}
            />
        </div>
    );
}
