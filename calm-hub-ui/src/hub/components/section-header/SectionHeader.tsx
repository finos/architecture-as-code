import { ReactNode, useState } from 'react';
import { IoCopyOutline, IoCheckmarkOutline, IoLinkOutline } from 'react-icons/io5';
import { isSlug } from '../../../model/calm.js';

interface SectionHeaderProps {
    icon: ReactNode;
    namespace: string;
    id: string;
    version: string;
    /** URL path segment for the resource type (e.g. "architectures", "flows"). Distinct from the display-only `typeLabel`. */
    typeSegment: string;
    rightContent?: ReactNode;
    /** When provided (and non-empty), the version renders as a selectable dropdown. */
    versions?: string[];
    onVersionChange?: (version: string) => void;
    /** Rendered inline immediately after the version (e.g. a Compare button). */
    titleActions?: ReactNode;
    /** Whether to render the trailing `/ version` segment. Defaults to true. */
    showVersion?: boolean;
    /** Human-readable name shown in the trail in place of the (often numeric) id. */
    displayName?: string;
    /** Element type label inserted into the trail (e.g. "Architecture"). */
    typeLabel?: string;
}

export function SectionHeader({ icon, namespace, id, version, typeSegment, rightContent, versions, onVersionChange, titleActions, showVersion = true, displayName, typeLabel }: SectionHeaderProps) {
    const [copied, setCopied] = useState(false);
    const showShareBar = isSlug(id);
    const shareUrl = `${window.location.origin}/calm/namespaces/${encodeURIComponent(namespace)}/${typeSegment}/${encodeURIComponent(id)}/versions/${encodeURIComponent(version)}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div>
            <div className="bg-base-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 border-b border-base-300">
                <h2 className="text-base sm:text-xl font-semibold flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    {icon}
                    {namespace}
                    {typeLabel && (
                        <>
                            {' '}
                            <span className="text-gray-400">/</span> {typeLabel}
                        </>
                    )}{' '}
                    <span className="text-gray-400">/</span>{' '}
                    <span title={id}>{displayName || id}</span>
                    {showVersion && (
                        <>
                            {' '}
                            <span className="text-gray-400">/</span>{' '}
                            {versions && versions.length > 0 ? (
                                <select
                                    className="select select-ghost text-xl font-semibold !h-auto !min-h-0 !py-0 !pl-1 !pr-6 !leading-tight !border-0 focus:!outline-none"
                                    value={version}
                                    onChange={(e) => onVersionChange?.(e.target.value)}
                                    aria-label="Version"
                                >
                                    {(versions.includes(version) ? versions : [version, ...versions]).map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <span>{version}</span>
                            )}
                        </>
                    )}
                    {titleActions}
                </h2>
                {rightContent}
            </div>
            {showShareBar && (
                <div className="bg-base-200 px-4 sm:px-6 py-2 flex items-center gap-2 border-b border-base-300" data-testid="share-bar">
                    <IoLinkOutline className="text-base-content/50 shrink-0" />
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
