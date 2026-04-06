import { ReactNode, useState } from 'react';
import { IoCopyOutline, IoCheckmarkOutline, IoLinkOutline } from 'react-icons/io5';

function isSlug(id: string): boolean {
    return !/^\d+$/.test(id);
}

interface SectionHeaderProps {
    icon: ReactNode;
    namespace: string;
    id: string;
    version: string;
    rightContent?: ReactNode;
}

export function SectionHeader({ icon, namespace, id, version, rightContent }: SectionHeaderProps) {
    const [copied, setCopied] = useState(false);
    const [pinned, setPinned] = useState(false);
    const showShareBar = isSlug(id);
    const latestUrl = `${window.location.origin}/calm/${namespace}/${id}`;
    const pinnedUrl = `${latestUrl}/versions/${version}`;
    const shareUrl = pinned ? pinnedUrl : latestUrl;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div>
            <div className="bg-base-200 px-6 py-4 flex items-center justify-between border-b border-base-300">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    {icon}
                    {namespace} <span className="text-gray-400">/</span> {id}{' '}
                    <span className="text-gray-400">/</span> {version}
                </h2>
                {rightContent}
            </div>
            {showShareBar && (
                <div className="bg-base-200 px-6 py-2 flex items-center gap-2 border-b border-base-300" data-testid="share-bar">
                    <IoLinkOutline className="text-base-content/50 shrink-0" />
                    <div className="join shrink-0">
                        <button
                            className={`join-item btn btn-xs ${!pinned ? 'btn-active' : 'btn-ghost'}`}
                            onClick={() => setPinned(false)}
                            title="Link to latest version"
                        >
                            Latest
                        </button>
                        <button
                            className={`join-item btn btn-xs ${pinned ? 'btn-active' : 'btn-ghost'}`}
                            onClick={() => setPinned(true)}
                            title="Link to this specific version"
                        >
                            Pinned
                        </button>
                    </div>
                    <div className="join flex-1">
                        <input
                            className="input input-sm input-bordered join-item w-full font-mono text-xs"
                            value={shareUrl}
                            readOnly
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            aria-label="Shareable URL"
                        />
                        <button
                            className="btn btn-sm join-item btn-outline"
                            title="Copy URL"
                            onClick={handleCopy}
                        >
                            {copied ? <IoCheckmarkOutline className="text-success" /> : <IoCopyOutline />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
