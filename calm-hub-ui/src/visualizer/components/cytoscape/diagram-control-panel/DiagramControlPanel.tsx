export interface DiagramControlPanelProps {
    title: string;
    isNodeDescActive: boolean;
    isRelationshipDescActive: boolean;
    toggleConnectionDesc: () => void;
    toggleNodeDesc: () => void;
}
export function DiagramControlPanel({
    isNodeDescActive,
    isRelationshipDescActive,
    toggleConnectionDesc,
    toggleNodeDesc,
}: DiagramControlPanelProps) {
    return (
        <div className="graph-title absolute m-6 bg-base-100 shadow-lg p-4 rounded-lg border border-base-300">
            <div>
                <div className="text-sm font-semibold mb-2 text-base-content">View</div>
                <div className="flex flex-col gap-2 text-sm">
                    <label className="label cursor-pointer">
                        <input
                            type="checkbox"
                            className="checkbox"
                            name="connection-description"
                            aria-label="connection-description"
                            checked={isRelationshipDescActive}
                            onChange={toggleConnectionDesc}
                        />
                        <span className="label-text text-base-content ml-2">
                            Relationship Descriptions
                        </span>
                    </label>
                    <label className="label cursor-pointer">
                        <input
                            className="checkbox"
                            type="checkbox"
                            aria-label="node-description"
                            checked={isNodeDescActive}
                            onChange={toggleNodeDesc}
                        />
                        <span className="label-text text-base-content ml-2">Node Descriptions</span>
                    </label>
                </div>
            </div>
        </div>
    );
}
