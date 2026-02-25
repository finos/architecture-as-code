import { PatternGraph } from './PatternGraph';

export interface PatternVisualizerProps {
    patternData: Record<string, unknown>;
    onNodeClick?: (nodeData: Record<string, unknown>) => void;
    onEdgeClick?: (edgeData: Record<string, unknown>) => void;
    onBackgroundClick?: () => void;
}

export function PatternVisualizer({
    patternData,
    onNodeClick,
    onEdgeClick,
    onBackgroundClick,
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
            />
        </div>
    );
}
