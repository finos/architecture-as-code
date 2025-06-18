import { useCallback, useState } from 'react';
import { CytoscapeNode, Edge } from '../../contracts/contracts.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { CytoscapeRenderer } from '../cytoscape-renderer/CytoscapeRenderer.js';

interface VisualizerContainerProps {
    title?: string;
    isNodeDescActive: boolean;
    isRelationshipDescActive: boolean;
    nodes: CytoscapeNode[];
    edges: Edge[];
    calmKey: string;
}

export function VisualizerContainer({
    title = '',
    nodes = [],
    edges = [],
    isRelationshipDescActive,
    isNodeDescActive,
    calmKey,
}: VisualizerContainerProps) {
    const [selectedItem, setSelectedItem] = useState<CytoscapeNode['data'] | Edge['data'] | null>(
        null
    );

    const entityClickedCallback = useCallback((x: CalmNode['data'] | Edge['data']) => setSelectedItem(x), []);

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
