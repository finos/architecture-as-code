import { useEffect, useMemo, useState } from 'react';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import { diffArchitectures, type DiffResult } from '@finos/calm-models/diff';
import { CalmService } from '../../../../service/calm-service.js';
import { Data } from '../../../../model/calm.js';
import { compareVersions, sortVersionsDescending } from '../../../../model/version.js';
import { DiffGraph } from '../../../../diff/components/DiffGraph.js';
import { DiffPanel } from '../../../../diff/components/DiffPanel.js';
import '../../../../diff/Diff.css';
import { CompareBar } from './CompareBar.js';
import { fetchVersionList, fetchVersionData, type ComparableType } from './compareData.js';

interface CompareViewProps {
    data: Data & { calmType: ComparableType };
    onExit: () => void;
}

export function CompareView({ data, onExit }: CompareViewProps) {
    const calmService = useMemo(() => new CalmService(), []);
    const [versions, setVersions] = useState<string[]>([]);
    const [versionA, setVersionA] = useState('');
    const [versionB, setVersionB] = useState('');
    const [archA, setArchA] = useState<CalmArchitectureSchema | null>(null);
    const [archB, setArchB] = useState<CalmArchitectureSchema | null>(null);
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isArchitecture = data.calmType === 'Architectures';

    // Load the version list and choose sensible defaults: B is the current
    // (latest) version, A is the next-older version.
    useEffect(() => {
        let cancelled = false;
        fetchVersionList(calmService, data.name, data.calmType, data.id)
            .then((list) => {
                if (cancelled) return;
                const sorted = sortVersionsDescending(list);
                setVersions(sorted);
                const b = sorted.includes(data.version) ? data.version : (sorted[0] ?? '');
                const older = sorted.filter((v) => compareVersions(v, b) < 0);
                setVersionB(b);
                setVersionA(older[0] ?? b);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load versions');
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.calmType, data.id, data.version]);

    // Fetch both selected versions and compute the diff (architectures only).
    useEffect(() => {
        if (!isArchitecture || !versionA || !versionB) return;
        let cancelled = false;
        setError(null);
        Promise.all([
            fetchVersionData(calmService, data.name, data.calmType, data.id, versionA),
            fetchVersionData(calmService, data.name, data.calmType, data.id, versionB),
        ])
            .then(([a, b]) => {
                if (cancelled) return;
                const archAData = (a.data ?? null) as CalmArchitectureSchema | null;
                const archBData = (b.data ?? null) as CalmArchitectureSchema | null;
                setArchA(archAData);
                setArchB(archBData);
                setDiffResult(archAData && archBData ? diffArchitectures(archAData, archBData) : null);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load architecture versions');
            });
        return () => {
            cancelled = true;
        };
    }, [calmService, data.name, data.calmType, data.id, versionA, versionB, isArchitecture]);

    return (
        <div className="h-full flex flex-col">
            <CompareBar
                versions={versions}
                versionA={versionA}
                versionB={versionB}
                onChangeA={setVersionA}
                onChangeB={setVersionB}
                onExit={onExit}
            />
            {!isArchitecture ? (
                <div
                    className="flex-1 flex items-center justify-center text-base-content/60 p-8 text-center"
                    data-testid="pattern-compare-placeholder"
                >
                    Pattern comparison is coming soon. Compare is currently available for architectures.
                </div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center text-error" data-testid="compare-error">
                    {error}
                </div>
            ) : (
                <div className="flex-1 flex min-h-0">
                    <div className="diff-graph-panel">
                        <div className="architectures-container">
                            <div className="architecture-panel">
                                <div className="architecture-header">Baseline: {versionA}</div>
                                <div className="architecture-graph">
                                    {archA && (
                                        <DiffGraph key={`a-${versionA}`} architecture={archA} diffResult={diffResult} isFirst={true} />
                                    )}
                                </div>
                            </div>
                            <div className="architecture-panel">
                                <div className="architecture-header">Comparison: {versionB}</div>
                                <div className="architecture-graph">
                                    {archB && (
                                        <DiffGraph key={`b-${versionB}`} architecture={archB} diffResult={diffResult} isFirst={false} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DiffPanel diffResult={diffResult} />
                </div>
            )}
        </div>
    );
}
