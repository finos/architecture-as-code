import { useState } from 'react';
import { Data } from '../../../model/calm.js';
import { PatternVisualizer } from '../reactflow/PatternVisualizer.js';
import { Sidebar } from '../sidebar/Sidebar.js';
import { NodeData, EdgeData } from '../../contracts/contracts.js';
import { toPatternNodeData, toPatternEdgeData } from '../reactflow/utils/patternClickHandlers.js';

interface PatternDrawerProps {
    data: Data & { calmType: 'Patterns' };
}

type SelectedItem = {
    data: NodeData | EdgeData;
} | null;

export function PatternDrawer({ data }: PatternDrawerProps) {
    const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
    const patternSchema = data.data;

    function closeSidebar() {
        setSelectedItem(null);
    }

    const handleNodeClick = (nodeData: Record<string, unknown>) => {
        setSelectedItem({ data: toPatternNodeData(nodeData) });
    };

    const handleEdgeClick = (edgeData: Record<string, unknown>) => {
        setSelectedItem({ data: toPatternEdgeData(edgeData) });
    };

    if (!patternSchema) {
        return (
            <div className="flex justify-center items-center h-full w-full">
                <p>No pattern data available</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex overflow-hidden h-full">
            <div className={`drawer drawer-end ${selectedItem ? 'drawer-open' : ''} w-full h-full`}>
                <input
                    type="checkbox"
                    aria-label="drawer-toggle"
                    className="drawer-toggle"
                    checked={!!selectedItem}
                    onChange={closeSidebar}
                />
                <div className="drawer-content h-full flex flex-col">
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <PatternVisualizer
                            patternData={patternSchema}
                            onNodeClick={handleNodeClick}
                            onEdgeClick={handleEdgeClick}
                            onBackgroundClick={closeSidebar}
                        />
                    </div>
                </div>
                {selectedItem && <Sidebar selectedData={selectedItem.data} closeSidebar={closeSidebar} />}
            </div>
        </div>
    );
}
