import { useState } from 'react';
import { IoGridOutline, IoEyeOutline, IoCodeOutline } from 'react-icons/io5';
import { Data } from '../../../model/calm.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { PatternDrawer } from '../../../visualizer/components/drawer/PatternDrawer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';

interface PatternSectionProps {
    data: Data & { calmType: 'Patterns' };
}

export function PatternSection({ data }: PatternSectionProps) {
    const [activeTab, setActiveTab] = useState<'diagram' | 'json'>('diagram');

    const tabs = (
        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
            <button
                role="tab"
                className={`tab gap-1 rounded-lg ${activeTab === 'diagram' ? 'tab-active !bg-accent !text-white' : ''}`}
                onClick={() => setActiveTab('diagram')}
            >
                <IoEyeOutline />
                Diagram
            </button>
            <button
                role="tab"
                className={`tab gap-1 rounded-lg ${activeTab === 'json' ? 'tab-active !bg-accent !text-white' : ''}`}
                onClick={() => setActiveTab('json')}
            >
                <IoCodeOutline />
                JSON
            </button>
        </div>
    );

    return (
        <div className="w-full h-full py-4 pl-2 pr-4">
            <div className="h-full bg-base-100 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                <SectionHeader
                    icon={<IoGridOutline className="text-accent" />}
                    namespace={data.name}
                    id={data.id}
                    version={data.version}
                    rightContent={tabs}
                />

                <div className="flex-1 min-h-0 overflow-hidden">
                    {activeTab === 'diagram' ? (
                        <div className="w-full h-full">
                            <PatternDrawer data={data} />
                        </div>
                    ) : (
                        <div className="h-full bg-base-200 overflow-auto">
                            <JsonRenderer json={data} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
