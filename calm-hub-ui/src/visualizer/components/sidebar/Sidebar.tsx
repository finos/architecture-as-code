import { useState } from 'react';
import { IoCubeOutline, IoGitNetworkOutline, IoEyeOutline, IoCodeOutline } from 'react-icons/io5';
import { JsonRenderer } from '../../../hub/components/json-renderer/JsonRenderer.js';
import { NodeDetails } from './NodeDetails.js';
import { RelationshipDetails } from './RelationshipDetails.js';
import { CloseButton } from './CloseButton.js';
import { isCALMNode, isCALMRelationship } from './calm-type-guards.js';
import type { SidebarProps } from '../../contracts/visualizer-contracts.js';

export function Sidebar({ selectedData, closeSidebar }: SidebarProps) {
    const [activeTab, setActiveTab] = useState<'details' | 'json'>('details');
    const isNode = isCALMNode(selectedData);
    const isRelationship = isCALMRelationship(selectedData);

    return (
        <div className="h-full w-full lg:w-96 shrink-0 lg:p-4 lg:pl-2">
            <div className="h-full bg-base-100 lg:rounded-box lg:shadow-xl flex flex-col overflow-hidden">
                <div className="bg-base-200 px-6 py-4 border-b border-base-300 flex items-center justify-between">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        {isNode ? (
                            <IoCubeOutline className="text-accent" />
                        ) : isRelationship ? (
                            <IoGitNetworkOutline className="text-accent" />
                        ) : null}
                        {isNode
                            ? 'Node'
                            : isRelationship
                              ? 'Relationship'
                              : 'Details'}
                    </h2>
                    <div className="flex items-center gap-1">
                        <div className="inline-flex rounded-lg bg-base-300 p-0.5">
                            <button
                                role="tab"
                                aria-label="Details"
                                onClick={() => setActiveTab('details')}
                                className={`p-1.5 rounded-md transition-colors ${activeTab === 'details' ? 'bg-accent text-accent-content' : 'text-base-content/50 hover:text-base-content'}`}
                            >
                                <IoEyeOutline size={14} />
                            </button>
                            <button
                                role="tab"
                                aria-label="JSON"
                                onClick={() => setActiveTab('json')}
                                className={`p-1.5 rounded-md transition-colors ${activeTab === 'json' ? 'bg-accent text-accent-content' : 'text-base-content/50 hover:text-base-content'}`}
                            >
                                <IoCodeOutline size={14} />
                            </button>
                        </div>
                        <CloseButton
                            onClick={(e) => {
                                e.stopPropagation();
                                closeSidebar();
                            }}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'details' ? (
                        (isNode || isRelationship) ? (
                            <div className="h-full overflow-auto">
                                {isNode ? (
                                    <NodeDetails data={selectedData} />
                                ) : (
                                    <RelationshipDetails data={selectedData} />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-base-content/60">
                                <p>Unknown Selected Entity</p>
                            </div>
                        )
                    ) : (
                        <div className="h-full bg-base-200 overflow-auto">
                            <JsonRenderer json={selectedData} showLineNumbers={false} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
