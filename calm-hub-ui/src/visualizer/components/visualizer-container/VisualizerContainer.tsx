import { useCallback, useState } from 'react';
import { CytoscapeNode, Edge } from '../../contracts/contracts.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { CytoscapeRenderer } from '../cytoscape/cytoscape-renderer/CytoscapeRenderer.js';
import { CytoscapeControlPanel } from '../cytoscape/cytoscape-control-panel/CytoscapeControlPanel.js';

export interface VisualizerContainerProps {
    title?: string;
    nodes: CytoscapeNode[];
    edges: Edge[];
    calmKey: string;
}

export function VisualizerContainer({
    title,
    nodes = [],
    edges = [],
    calmKey,
}: VisualizerContainerProps) {
    const [isRelationshipDescActive, setConDescActive] = useState(true);
    const [isNodeDescActive, setNodeDescActive] = useState(true);
    const toggleNodeDesc = () => setNodeDescActive((prev) => !prev);
    const toggleConnectionDesc = () => setConDescActive((prev) => !prev);
    const [selectedItem, setSelectedItem] = useState<CytoscapeNode['data'] | Edge['data'] | null>(
        null
    );

    const entityClickedCallback = useCallback(
        (x: CytoscapeNode['data'] | Edge['data']) => setSelectedItem(x),
        []
    );

    return (
        <div className="relative flex m-auto border" data-testid="visualizer-container">
            {title && (
                <CytoscapeControlPanel
                    title={title}
                    isNodeDescActive={isNodeDescActive}
                    isRelationshipDescActive={isRelationshipDescActive}
                    toggleNodeDesc={toggleNodeDesc}
                    toggleConnectionDesc={toggleConnectionDesc}
                />
            )}
            <CytoscapeRenderer
                isNodeDescActive={isNodeDescActive}
                isRelationshipDescActive={isRelationshipDescActive}
                nodes={nodes}
                edges={edges}
                nodeClickedCallback={entityClickedCallback}
                edgeClickedCallback={entityClickedCallback}
                calmKey={calmKey}
            />
            {selectedItem && (
                <Sidebar
                    selectedData={(() => {
                        // Note: assigning cytoscapeProps to undefined, then gets rendered in the sidebar JSON rederer.
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { cytoscapeProps, ...nodeData } = selectedItem;
                        return nodeData;
                    })()}
                    closeSidebar={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}
