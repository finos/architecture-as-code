import { useState } from 'react';
import { IoCodeOutline, IoCubeOutline, IoEyeOutline, IoGitNetworkOutline } from 'react-icons/io5';
import type { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';
import { JsonRenderer } from '../../../hub/components/json-renderer/JsonRenderer.js';
import { NodeDetails } from './NodeDetails.js';
import { RelationshipDetails } from './RelationshipDetails.js';
import { isCALMNode, isCALMRelationship } from './calm-type-guards.js';

/** The details of the selected node or relationship, readable or as JSON. */
export function ElementDetails({ selectedData }: { selectedData: CalmNodeSchema | CalmRelationshipSchema }) {
    const [view, setView] = useState<'details' | 'json'>('details');
    const isNode = isCALMNode(selectedData);
    const isRelationship = isCALMRelationship(selectedData);
    const toggle = (value: 'details' | 'json', label: string, Icon: typeof IoEyeOutline) => (
        <button
            type="button"
            aria-label={label}
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={`p-1.5 rounded-md transition-colors ${view === value ? 'bg-accent text-accent-content' : 'text-base-content/50 hover:text-base-content'}`}
        >
            <Icon size={14} />
        </button>
    );

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="px-4 pt-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold flex items-center gap-2">
                    {isNode ? <IoCubeOutline className="text-accent" /> : isRelationship ? <IoGitNetworkOutline className="text-accent" /> : null}
                    {isNode ? 'Node' : isRelationship ? 'Relationship' : 'Details'}
                </h2>
                <div className="inline-flex rounded-lg bg-base-300 p-0.5" role="group" aria-label="Show as">
                    {toggle('details', 'Readable', IoEyeOutline)}
                    {toggle('json', 'JSON', IoCodeOutline)}
                </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {view === 'json' ? (
                    <div className="h-full bg-base-200 overflow-auto mt-3">
                        <JsonRenderer json={selectedData} showLineNumbers={false} />
                    </div>
                ) : isNode ? (
                    <NodeDetails data={selectedData} />
                ) : isRelationship ? (
                    <RelationshipDetails data={selectedData} />
                ) : (
                    <div className="flex items-center justify-center h-full text-base-content/60">
                        <p>Unknown Selected Entity</p>
                    </div>
                )}
            </div>
        </div>
    );
}
