import { IoGitCompareOutline, IoArrowForwardOutline, IoCloseOutline } from 'react-icons/io5';

interface CompareBarProps {
    versions: string[];
    versionA: string;
    versionB: string;
    onChangeA: (version: string) => void;
    onChangeB: (version: string) => void;
    onExit: () => void;
}

export function CompareBar({ versions, versionA, versionB, onChangeA, onChangeB, onExit }: CompareBarProps) {
    return (
        <div
            className="bg-base-200 px-6 py-2 flex items-center gap-3 border-b border-base-300"
            data-testid="compare-bar"
        >
            <span className="flex items-center gap-2 text-sm font-medium text-base-content/70 shrink-0">
                <IoGitCompareOutline />
                Compare
            </span>
            <select
                className="select select-sm select-bordered font-mono text-xs"
                value={versionA}
                onChange={(e) => onChangeA(e.target.value)}
                aria-label="Baseline version"
            >
                {versions.map((version) => (
                    <option key={version} value={version}>
                        {version}
                    </option>
                ))}
            </select>
            <IoArrowForwardOutline className="text-base-content/50 shrink-0" />
            <select
                className="select select-sm select-bordered font-mono text-xs"
                value={versionB}
                onChange={(e) => onChangeB(e.target.value)}
                aria-label="Comparison version"
            >
                {versions.map((version) => (
                    <option key={version} value={version}>
                        {version}
                    </option>
                ))}
            </select>
            <button
                className="btn btn-ghost btn-sm btn-circle ml-auto"
                onClick={onExit}
                aria-label="Exit compare"
                title="Exit compare"
            >
                <IoCloseOutline />
            </button>
        </div>
    );
}
