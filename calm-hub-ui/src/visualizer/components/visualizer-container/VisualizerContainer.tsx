import { useState } from 'react';
import { CalmNode, Edge } from '../../contracts/contracts.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { CytoscapeRenderer } from '../cytoscape-renderer/CytoscapeRenderer.js';

interface VisualizerContainerProps {
    title?: string;
    isNodeDescActive: boolean;
    isRelationshipDescActive: boolean;
    nodes: CalmNode[];
    edges: Edge[];
}

export function VisualizerContainer({
    title,
    nodes = [],
    edges = [],
    isRelationshipDescActive,
    isNodeDescActive,
}: VisualizerContainerProps) {
    const [selectedItem, setSelectedItem] = useState<CalmNode['data'] | Edge['data'] | null>(null);

    return (
        <div className="relative flex m-auto border" data-testid="visualizer-container">
            {title && (
                <div className="graph-title absolute m-5 bg-accent shadow-md">
                    <span className="text-m font-thin text-primary-content">Architecture: </span>
                    <span className="text-m font-semibold text-primary-content">{title}</span>
                </div>
            )}
            <CytoscapeRenderer
                isNodeDescActive={isNodeDescActive}
                isRelationshipDescActive={isRelationshipDescActive}
                nodes={nodes}
                edges={edges}
                nodeClickedCallback={(x) => setSelectedItem(x)}
                edgeClickedCallback={(x) => setSelectedItem(x)}
            />
            {selectedItem && (
                <Sidebar selectedData={selectedItem} closeSidebar={() => setSelectedItem(null)} />
            )}
        </div>
    );
}
