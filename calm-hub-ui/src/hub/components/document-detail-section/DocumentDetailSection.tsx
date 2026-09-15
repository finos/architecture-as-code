import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoGridOutline, IoGitNetworkOutline } from 'react-icons/io5';
import Markdown from 'react-markdown';
import { Data, isSlug } from '../../../model/calm.js';
import { CalmService } from '../../../service/calm-service.js';
import { sortVersionsDescending } from '../../../model/version.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';

interface DocumentDetailSectionProps {
    data?: Data;
}

function getDisplayName(data: Data): string {
    if (typeof data.data === 'string') {
        const content = data.data as string;
        const headingMatch = content.match(/^#\s+(.+)$/m);
        if (headingMatch) return headingMatch[1];
    }
    if (typeof data.data === 'object' && data.data && 'name' in (data.data as object)) {
        return String((data.data as Record<string, unknown>).name);
    }
    return data.id;
}

function isMarkdownContent(data: Data): boolean {
    if (typeof data.data !== 'string') return false;
    const content = data.data as string;
    return content.startsWith('#') || content.startsWith('---') || !content.startsWith('{');
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
                    displayName={getDisplayName(data)}
                    typeLabel={data.calmType}
                    version={data.version}
                    typeSegment={calmTypeToUrlSegment(data.calmType)}
                    versions={versions}
                    onVersionChange={handleVersionChange}
                />

                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    {isMarkdownContent(data) ? (
                        <div className="prose prose-sm max-w-none p-6 bg-base-100">
                            <Markdown>{data.data as string}</Markdown>
                        </div>
                    ) : (
                        <JsonRenderer json={data} />
                    )}
                </div>
            </div>
        </div>
    );
}
