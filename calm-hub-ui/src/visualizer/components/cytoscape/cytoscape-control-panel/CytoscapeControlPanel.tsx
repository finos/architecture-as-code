export interface CytoscapeControlPanelProps {
    title: string;
    isNodeDescActive: boolean;
    isRelationshipDescActive: boolean;
    toggleConnectionDesc: () => void;
    toggleNodeDesc: () => void;
}
export function CytoscapeControlPanel({
    title,
    isNodeDescActive,
    isRelationshipDescActive,
    toggleConnectionDesc,
    toggleNodeDesc,
}: CytoscapeControlPanelProps) {
    return (
        <div className="graph-title absolute m-5 btn-outline btn-primary shadow-md p-4">
            <div className="mb-4">
                <span className="text-lg font-thin text-primary">Architecture: </span>
                <span className="text-lg font-semibold text-primary">{title}</span>
            </div>
            <hr className="my-4 border-base-300" />
            <div>
                <div className="text-sm font-semibold mb-2 text-primary">Display Settings</div>
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
