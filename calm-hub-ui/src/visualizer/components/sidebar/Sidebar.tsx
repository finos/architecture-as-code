import { IoCloseOutline, IoCubeOutline, IoGitNetworkOutline } from 'react-icons/io5';
import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { JsonRenderer } from '../../../hub/components/json-renderer/JsonRenderer.js';
import type { SidebarProps } from '../../contracts/visualizer-contracts.js';

function isCALMNode(data: CalmNodeSchema | CalmRelationshipSchema): data is CalmNodeSchema {
    return 'node-type' in data;
}

function isCALMRelationship(data: CalmNodeSchema | CalmRelationshipSchema): data is CalmRelationshipSchema {
    return 'relationship-type' in data;
}

export function Sidebar({ selectedData, closeSidebar }: SidebarProps) {
    const isNode = isCALMNode(selectedData);
    const isRelationship = isCALMRelationship(selectedData);

    return (
        <div className="p-4 pl-2 h-full w-96 shrink-0">
            <div className="h-full bg-base-100 rounded-box shadow-xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-base-200 px-6 py-4 border-b border-base-300 flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        {isNode ? (
                            <IoCubeOutline className="text-accent" />
                        ) : isRelationship ? (
                            <IoGitNetworkOutline className="text-accent" />
                        ) : null}
                        {isNode
                            ? 'Node Details'
                            : isRelationship
                              ? 'Relationship Details'
                              : 'Details'}
                    </h2>
                    <button
                        aria-label="close-sidebar"
                        onClick={(e) => {
                            e.stopPropagation();
                            closeSidebar();
                        }}
                        className="btn btn-ghost btn-xs btn-circle"
                    >
                        <IoCloseOutline size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col p-4 min-h-0">
                    {(isNode || isRelationship) ? (
                        <div className="flex-1 bg-base-200 rounded-lg border border-base-300 overflow-auto shadow-sm min-h-0">
                            <JsonRenderer json={selectedData} showLineNumbers={false} />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center flex-1 text-base-content/60">
                            <p>Unknown Selected Entity</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
