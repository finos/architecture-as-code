import { useState } from 'react';
import { CytoscapeNode, CytoscapeEdge } from '../../contracts/contracts.js';
import { CytoscapeRenderer } from '../cytoscape/cytoscape-renderer/CytoscapeRenderer.js';
import { DiagramControlPanel } from '../cytoscape/diagram-control-panel/DiagramControlPanel.js';

export interface VisualizerContainerProps {
    title: string;
    nodes: CytoscapeNode[];
    edges: CytoscapeEdge[];
    calmKey: string;
    nodeClickedCallback: (x: CytoscapeNode['data']) => void;
    edgeClickedCallback: (x: CytoscapeEdge['data']) => void;
    backgroundClickedCallback?: () => void;
    selectedItemId?: string;
}

export function VisualizerContainer({
    title,
    nodes = [],
    edges = [],
    calmKey,
    nodeClickedCallback,
    edgeClickedCallback,
    backgroundClickedCallback,
    selectedItemId,
}: VisualizerContainerProps) {
    const [isRelationshipDescActive, setConDescActive] = useState(true);
    const [isNodeDescActive, setNodeDescActive] = useState(true);
    const toggleNodeDesc = () => setNodeDescActive((prev) => !prev);
    const toggleConnectionDesc = () => setConDescActive((prev) => !prev);

    return (
        <div className="relative flex m-auto" data-testid="visualizer-container">
            <DiagramControlPanel
                title={title}
                isNodeDescActive={isNodeDescActive}
                isRelationshipDescActive={isRelationshipDescActive}
                toggleNodeDesc={toggleNodeDesc}
                toggleConnectionDesc={toggleConnectionDesc}
            />
            <CytoscapeRenderer
                isNodeDescActive={isNodeDescActive}
                isRelationshipDescActive={isRelationshipDescActive}
                nodes={nodes}
                edges={edges}
                nodeClickedCallback={nodeClickedCallback}
                edgeClickedCallback={edgeClickedCallback}
                backgroundClickedCallback={backgroundClickedCallback}
                selectedItemId={selectedItemId}
                calmKey={calmKey}
            />
        </div>
    );
}
