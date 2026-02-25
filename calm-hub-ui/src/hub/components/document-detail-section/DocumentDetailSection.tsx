import { IoGridOutline, IoGitNetworkOutline } from 'react-icons/io5';
import { Data } from '../../../model/calm.js';
import { JsonRenderer } from '../json-renderer/JsonRenderer.js';
import { SectionHeader } from '../section-header/SectionHeader.js';

interface DocumentDetailSectionProps {
    data?: Data;
}

export function DocumentDetailSection({ data }: DocumentDetailSectionProps) {
    if (!data) return null;

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
            <div className="h-full bg-base-100 rounded-2xl overflow-hidden flex flex-col shadow-xl">
                <SectionHeader
                    icon={getIcon()}
                    namespace={data.name}
                    id={data.id}
                    version={data.version}
                />

                <div className="flex-1 min-h-0 overflow-auto bg-base-200">
                    <JsonRenderer json={data} />
                </div>
            </div>
        </div>
    );
}
