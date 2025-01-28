import Sidebar from '../sidebar/Sidebar';
import { useState } from 'react';
import CytoscapeRenderer, { Edge, Node } from '../cytoscape-renderer/CytoscapeRenderer.tsx';
import {
    CALMArchitecture,
} from '../../../../shared/src';
import { CalmVisualizationVisitor } from './visualizerVisitor';

interface DrawerProps {
    calmInstance?: CALMArchitecture;
    rawCalm?: string;
    title?: string;
    isNodeDescActive: boolean;
    isConDescActive: boolean;
}

function Drawer({ calmInstance, title, isConDescActive, isNodeDescActive, rawCalm }: DrawerProps) {
    const [selectedNode, setSelectedNode] = useState(null);

    function closeSidebar() {
        setSelectedNode(null);
    }

    let nodes: Node[] = [];
    let edges: Edge[] = [];
    if (rawCalm) {
        const visitor = new CalmVisualizationVisitor(rawCalm);
        edges = visitor.getEdges();
        nodes = visitor.getNodes();
    }


    return (
        <div className="flex-1 flex overflow-hidden">
            <div className={`drawer drawer-end ${selectedNode ? 'drawer-open' : ''}`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedNode}
                    onChange={closeSidebar}
                />
                <div className="drawer-content">
                    {calmInstance ? (
                        <CytoscapeRenderer
                            isConDescActive={isConDescActive}
                            isNodeDescActive={isNodeDescActive}
                            title={title}
                            nodes={nodes}
                            edges={edges}
                        />
                    ) : (
                        <div className="flex justify-center items-center h-full">
                            No file selected
                        </div>
                    )}
                </div>
                {selectedNode && (
                    <Sidebar selectedData={selectedNode} closeSidebar={closeSidebar} />
                )}
            </div>
        </div>
    );
}

export default Drawer;
