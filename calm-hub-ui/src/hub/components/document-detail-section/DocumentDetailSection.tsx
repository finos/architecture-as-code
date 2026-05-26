import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoGridOutline, IoGitNetworkOutline } from 'react-icons/io5';
import { Data } from '../../../model/calm.js';
import { CalmService } from '../../../service/calm-service.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';

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

    useEffect(() => {
        if (!data) return;
        setVersions([]);
        let cancelled = false;
        let fetchPromise: Promise<string[]>;
        if (data.calmType === 'Standards') {
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

    if (!data) return null;

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

    return (
        <div className="w-full h-full py-4 pl-2 pr-4">
            <div className="h-full bg-base-100 rounded-box overflow-hidden flex flex-col shadow-xl">
                <SectionHeader
                    icon={getIcon()}
                    namespace={data.name}
                    id={data.id}
                    version={data.version}
                    versions={versions}
                    onVersionChange={handleVersionChange}
                />

                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    <JsonRenderer json={data} />
                </div>
            </div>
        </div>
    );
}
