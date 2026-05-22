import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IoConstructOutline, IoGridOutline, IoEyeOutline, IoCodeOutline, IoRocketOutline, IoGitCompareOutline } from 'react-icons/io5';
import { Data } from '../../../model/calm.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { Drawer } from '../../../visualizer/components/drawer/Drawer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';
import { DeploymentPanel } from '../../../visualizer/components/reactflow/DeploymentPanel.js';
import { CompareView } from './compare/CompareView.js';
import { fetchVersionList } from './compare/compareData.js';
import { CalmService } from '../../../service/calm-service.js';
import type { DeploymentDecorator, SelectedItem } from '../../../visualizer/contracts/contracts.js';

interface DiagramSectionProps {
    data: Data & { calmType: 'Architectures' | 'Patterns' };
    onItemSelect?: (item: SelectedItem) => void;
    hasDetailsPanel?: boolean;
}

const iconMap = {
    Architectures: IoConstructOutline,
    Patterns: IoGridOutline,
} as const;

type DiagramTabType = 'diagram' | 'json' | 'deployments';

export function DiagramSection({ data, onItemSelect, hasDetailsPanel }: DiagramSectionProps) {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const tabParam = searchParams.get('tab') as DiagramTabType | null;
    const activeTab: DiagramTabType = tabParam ?? 'diagram';
    const calmService = useMemo(() => new CalmService(), []);
    const [decorators, setDecorators] = useState<DeploymentDecorator[]>([]);
    const [compareMode, setCompareMode] = useState(false);
    const [versions, setVersions] = useState<string[]>([]);

    const setActiveTab = (tab: DiagramTabType) => {
        setCompareMode(false);
        setSearchParams({ tab }, { replace: true });
    };

    const isArchitecture = data.calmType === 'Architectures';
    const urlType = isArchitecture ? 'architectures' : 'patterns';

    const handleVersionChange = (version: string) => {
        if (version === data.version) return;
        // Preserve the active tab when switching version.
        const query = activeTab !== 'diagram' ? `?tab=${activeTab}` : '';
        navigate(`/${data.name}/${urlType}/${data.id}/${version}${query}`);
    };

    useEffect(() => {
        setCompareMode(false);
    }, [data.name, data.id, data.calmType]);

    useEffect(() => {
        let cancelled = false;
        fetchVersionList(calmService, data.name, data.calmType, data.id)
            .then((list) => {
                if (!cancelled) setVersions(sortVersionsDescending(list));
            })
            .catch(() => {
                if (!cancelled) setVersions([]);
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.calmType, data.id]);

    useEffect(() => {
        if (!isArchitecture) {
            setDecorators([]);
            return;
        }
        const versionPath = data.version.replace(/\./g, '-');
        const target = `/calm/namespaces/${data.name}/architectures/${data.id}/versions/${versionPath}`;
        calmService.fetchDecoratorValues(data.name, target, 'deployment').then((values) => setDecorators(values as DeploymentDecorator[]));
    }, [data, isArchitecture, calmService]);

    const Icon = iconMap[data.calmType];

    const tabs = (
        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-100">
            <button
                role="tab"
                className={`tab gap-1 rounded-lg ${!compareMode && activeTab === 'diagram' ? 'tab-active !bg-accent !text-white' : ''}`}
                onClick={() => setActiveTab('diagram')}
            >
                <IoEyeOutline />
                Diagram
            </button>
            <button
                role="tab"
                className={`tab gap-1 rounded-lg ${!compareMode && activeTab === 'json' ? 'tab-active !bg-accent !text-white' : ''}`}
                onClick={() => setActiveTab('json')}
            >
                <IoCodeOutline />
                JSON
            </button>
            {isArchitecture && (
                <button
                    role="tab"
                    className={`tab gap-1 rounded-lg ${!compareMode && activeTab === 'deployments' ? 'tab-active !bg-accent !text-white' : ''}`}
                    onClick={() => setActiveTab('deployments')}
                >
                    <IoRocketOutline />
                    Deployments
                </button>
            )}
        </div>
    );

    const compareButton = (
        <button
            className={`btn btn-sm gap-1 ${compareMode ? 'btn-active' : 'btn-ghost'}`}
            onClick={() => setCompareMode((m) => !m)}
            aria-label="Compare versions"
            title={compareMode ? 'Exit compare' : 'Compare versions'}
        >
            <IoGitCompareOutline />
            Compare
        </button>
    );

    return (
        <div className={`w-full h-full py-4 pl-2 ${hasDetailsPanel ? 'pr-2' : 'pr-4'}`}>
            <div className="h-full bg-base-100 rounded-box overflow-hidden flex flex-col shadow-xl">
                <SectionHeader
                    icon={<Icon className="text-accent" />}
                    namespace={data.name}
                    id={data.id}
                    version={data.version}
                    versions={versions}
                    onVersionChange={handleVersionChange}
                    titleActions={compareButton}
                    rightContent={tabs}
                />

                <div className="flex-1 min-h-0 overflow-hidden">
                    {compareMode ? (
                        <CompareView data={data} versions={versions} onExit={() => setCompareMode(false)} />
                    ) : activeTab === 'diagram' ? (
                        <div className="w-full h-full">
                            <Drawer data={data} onItemSelect={onItemSelect} decorators={decorators} />
                        </div>
                    ) : activeTab === 'deployments' && isArchitecture ? (
                        <div className="h-full bg-base-200 overflow-auto p-4">
                            <DeploymentPanel decorators={decorators} />
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
