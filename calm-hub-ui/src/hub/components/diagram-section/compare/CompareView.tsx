import { useEffect, useMemo, useState } from 'react';
import type { CalmArchitectureSchema } from '@finos/calm-models/types';
import { diffArchitectures, type DiffResult } from '@finos/calm-models/diff';
import { CalmService } from '../../../../service/calm-service.js';
import { Data } from '../../../../model/calm.js';
import { compareVersions } from '../../../../model/version.js';
import { DiffGraph } from '../../../../diff/components/DiffGraph.js';
import { DiffPanel } from '../../../../diff/components/DiffPanel.js';
import '../../../../diff/Diff.css';
import { CompareBar } from './CompareBar.js';
import { fetchVersionData } from './compareData.js';

interface CompareViewProps {
    data: Data & { calmType: 'Architectures' };
    /** Available versions for this resource, sorted newest-first. */
    versions: string[];
    onExit: () => void;
}

export function CompareView({ data, versions, onExit }: CompareViewProps) {
    const calmService = useMemo(() => new CalmService(), []);
    const [versionA, setVersionA] = useState('');
    const [versionB, setVersionB] = useState('');
    const [archA, setArchA] = useState<CalmArchitectureSchema | null>(null);
    const [archB, setArchB] = useState<CalmArchitectureSchema | null>(null);
    const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Choose sensible defaults: B is the currently-viewed version, A is the
    // next-older version.
    useEffect(() => {
        if (versions.length === 0) return;
        const b = versions.includes(data.version) ? data.version : versions[0];
        const older = versions.filter((v) => compareVersions(v, b) < 0);
        setVersionB(b);
        setVersionA(older[0] ?? b);
    }, [versions, data.version]);

    // Fetch both selected versions and compute the diff.
    useEffect(() => {
        if (!versionA || !versionB) return;
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
    }, [calmService, data.name, data.calmType, data.id, versionA, versionB]);

    // Keep the two selectors on different versions: when a change would make them
    // equal, move the other selector to the adjacent (preferring previous/older) version.
    const adjacentVersion = (version: string): string => {
        const idx = versions.indexOf(version);
        return versions[idx + 1] ?? versions[idx - 1] ?? version;
    };

    const handleChangeA = (version: string) => {
        setVersionA(version);
        if (version === versionB) setVersionB(adjacentVersion(version));
    };

    const handleChangeB = (version: string) => {
        setVersionB(version);
        if (version === versionA) setVersionA(adjacentVersion(version));
    };

    return (
        <div className="h-full flex flex-col">
            <CompareBar
                versions={versions}
                versionA={versionA}
                versionB={versionB}
                onChangeA={handleChangeA}
                onChangeB={handleChangeB}
                onExit={onExit}
            />
            {error ? (
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
