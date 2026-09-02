import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoGridOutline, IoGitNetworkOutline, IoPlayOutline, IoCodeOutline, IoCubeOutline } from 'react-icons/io5';
import { CalmCore } from '@finos/calm-models/model';
import type { Architecture } from '@finos/calm-models/model';
import type { CalmCoreSchema } from '@finos/calm-models/types';
import { Data, isSlug } from '../../../model/calm.js';
import { CalmService } from '../../../service/calm-service.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';
import { TimelineBar } from '../diagram-section/timeline/TimelineBar.js';
import { momentsFromVersions } from '../diagram-section/timeline/timelineMoments.js';
import { FlowSequenceDiagram } from '../flow-sequence-diagram/FlowSequenceDiagram.js';
import { FlowArchitectureDiagram } from '../flow-sequence-diagram/FlowArchitectureDiagram.js';

type FlowViewMode = 'sequence' | 'architecture' | 'raw';

const DEFAULT_ARCHITECTURE_VERSION = '1.0.0';

interface DocumentDetailSectionProps {
    data?: Data;
}

function calmTypeToUrlSegment(calmType: string): string {
    switch (calmType) {
        case 'Standards': return 'standards';
        case 'Flows': return 'flows';
        default: return calmType.toLowerCase();
    }
}

export function DocumentDetailSection({ data }: DocumentDetailSectionProps) {
    const navigate = useNavigate();
    const calmService = useMemo(() => new CalmService(), []);
    const [versions, setVersions] = useState<string[]>([]);
    const [flowView, setFlowView] = useState<FlowViewMode>('sequence');
    const [architectureData, setArchitectureData] = useState<CalmCoreSchema | null>(null);

    useEffect(() => {
        if (!data) return;
        setVersions([]);
        let cancelled = false;
        let fetchPromise: Promise<string[]>;
        if (isSlug(data.id)) {
            fetchPromise = calmService.fetchVersionsByCustomId(data.name, data.id, data.calmType);
        } else if (data.calmType === 'Standards') {
            fetchPromise = calmService.fetchStandardVersions(data.name, data.id);
        } else if (data.calmType === 'Flows') {
            fetchPromise = calmService.fetchFlowVersions(data.name, data.id);
        } else {
            return;
        }
        fetchPromise
            .then((list) => { if (!cancelled) setVersions(sortVersionsDescending(list)); })
            .catch(() => { if (!cancelled) setVersions([]); });
        return () => { cancelled = true; };
    }, [calmService, data]);

    // Fetch the architecture that the flow draws over. CALM has no link from a flow to
    // its architecture. This code fetches all architectures in the namespace and selects
    // the one whose relationships best match the flow's transition ids. The match is a
    // heuristic and can select the wrong architecture. See #2950 for the schema work.
    useEffect(() => {
        if (!data || data.calmType !== 'Flows') return;
        setArchitectureData(null);
        let cancelled = false;
        (async () => {
            try {
                const archs = await calmService.fetchArchitectureSummaries(data.name);
                if (cancelled || !archs || archs.length === 0) return;
                const flowData = data.data as { transitions?: { 'relationship-unique-id': string }[] } | undefined;
                const flowRelIds = new Set((flowData?.transitions || []).map(t => t['relationship-unique-id']));

                let bestArch: CalmCoreSchema | null = null;
                let bestCount = 0;

                const archResults = await Promise.all(archs.map(async (arch) => {
                    let version = DEFAULT_ARCHITECTURE_VERSION;
                    try {
                        const versions = await calmService.fetchArchitectureVersions(data.name, String(arch.id));
                        if (versions && versions.length > 0) {
                            version = sortVersionsDescending(versions)[0];
                        }
                    } catch {
                        // Fall back to the default version if the lookup fails.
                    }
                    const result = await calmService.fetchArchitecture(data.name, String(arch.id), version);
                    return result?.data as CalmCoreSchema | undefined;
                }));

                if (cancelled) return;

                for (const archDoc of archResults) {
                    const matchCount = (archDoc?.relationships || [])
                        .filter(r => flowRelIds.has(r['unique-id'])).length;
                    if (matchCount > bestCount) {
                        bestCount = matchCount;
                        bestArch = archDoc ?? null;
                    }
                }

                if (!cancelled) {
                    setArchitectureData(bestArch);
                }
            } catch (err) {
                console.error('Failed to fetch architecture for flow overlay:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [calmService, data]);

    // This hook must stay above any early return. The hook count must not change
    // between renders.
    const architecture: Architecture | null = useMemo(() => {
        if (!architectureData) return null;
        try {
            return CalmCore.fromSchema(architectureData);
        } catch (err) {
            console.error('Failed to parse architecture into CalmCore:', err);
            return null;
        }
    }, [architectureData]);

    // `versions` is newest-first. momentsFromVersions reverses it, so the bar reads
    // oldest (left) to newest (right), as on the architecture view.
    const timelineMoments = useMemo(() => momentsFromVersions(versions), [versions]);

    if (!data) return null;

    const isFlow = data.calmType === 'Flows';

    // The route carries only the id, which is usually numeric. The breadcrumb shows
    // the document name and a singular type label: "finos / Flow / Payments / 1.0.0".
    const displayName = isFlow ? data.data?.name : undefined;
    const typeLabel = isFlow ? 'Flow'
        : data.calmType === 'Standards' ? 'Standard'
            : undefined;

    const handleVersionChange = (version: string) => {
        if (version === data.version) return;
        navigate(`/${data.name}/${calmTypeToUrlSegment(data.calmType)}/${data.id}/${version}`);
    };

    const getIcon = () => {
        switch (data.calmType) {
            case 'Patterns':
                return <IoGridOutline className="text-accent" />;
            case 'Flows':
                return <IoGitNetworkOutline className="text-accent" />;
            default:
                return null;
        }
    };

    const tabClass = (mode: FlowViewMode) =>
        `flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${flowView === mode ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'}`;

    const flowToggle = isFlow ? (
        <div role="tablist" className="inline-flex rounded-lg bg-base-300 p-0.5">
            <button type="button" role="tab" aria-label="Sequence Diagram" aria-selected={flowView === 'sequence'}
                title="Sequence Diagram" className={tabClass('sequence')} onClick={() => setFlowView('sequence')}>
                <IoPlayOutline size={14} /> Sequence
            </button>
            <button type="button" role="tab" aria-label="Architecture View" aria-selected={flowView === 'architecture'}
                title="Architecture View" className={tabClass('architecture')} onClick={() => setFlowView('architecture')}>
                <IoCubeOutline size={14} /> Architecture
            </button>
            <button type="button" role="tab" aria-label="Raw JSON" aria-selected={flowView === 'raw'}
                title="Raw JSON" className={tabClass('raw')} onClick={() => setFlowView('raw')}>
                <IoCodeOutline size={14} /> JSON
            </button>
        </div>
    ) : undefined;

    return (
        <div className="w-full h-full py-4 pl-2 pr-4">
            <div className="h-full bg-base-100 rounded-box overflow-hidden flex flex-col shadow-xl">
                <SectionHeader
                    icon={getIcon()}
                    namespace={data.name}
                    id={data.id}
                    version={data.version}
                    typeSegment={calmTypeToUrlSegment(data.calmType)}
                    typeLabel={typeLabel}
                    displayName={displayName}
                    showVersion={false}
                    rightContent={flowToggle}
                />

                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {isFlow && flowView === 'sequence' ? (
                        <FlowSequenceDiagram flowJson={data.data ?? {}} architecture={architecture} />
                    ) : isFlow && flowView === 'architecture' ? (
                        architecture
                            ? <FlowArchitectureDiagram flowJson={data.data ?? {}} architectureJson={architectureData} architecture={architecture} />
                            : <div className="flex items-center justify-center h-full text-base-content/50">Loading architecture...</div>
                    ) : (
                        <JsonRenderer json={data} />
                    )}
                </div>

                {timelineMoments.length > 0 && (
                    <TimelineBar
                        moments={timelineMoments}
                        currentVersion={data.version}
                        displayName={displayName}
                        onNavigate={handleVersionChange}
                    />
                )}
            </div>
        </div>
    );
}
