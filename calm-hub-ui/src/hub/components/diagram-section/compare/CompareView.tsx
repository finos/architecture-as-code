import type { DiffResult } from '@finos/calm-models/diff';
import { DiffGraph } from '../../../../diff/components/DiffGraph.js';
import type { DiffSource } from '../../../../diff/model/diff-ui-types.js';
import '../../../../diff/Diff.css';

interface CompareViewProps {
    calmType: 'Architectures' | 'Patterns';
    /** Baseline (from / left) version label, shown in the pane header. */
    versionA: string;
    /** Comparison (to / right) version label, shown in the pane header. */
    versionB: string;
    sourceA: DiffSource | null;
    sourceB: DiffSource | null;
    /** The shared diff result; drives the highlight overlay on both panes. */
    diffResult: DiffResult | null;
    /** Error message to display in place of the panes. */
    error?: string | null;
}

/**
 * Side-by-side Baseline / Comparison diagram panes for compare mode. Pure
 * renderer: the parent (DiagramSection) fetches both versions and computes the
 * DiffResult so the inline diff summary in the timeline can share it.
 */
export function CompareView({
    calmType,
    versionA,
    versionB,
    sourceA,
    sourceB,
    diffResult,
    error = null,
}: CompareViewProps) {
    if (error) {
        return (
            <div
                className="h-full flex items-center justify-center text-error"
                data-testid="compare-error"
            >
                {error}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 flex min-h-0">
                <div className="diff-graph-panel" style={{ flex: 1 }}>
                    <div className="architectures-container">
                        <div className="architecture-panel">
                            <div className="architecture-header">Baseline: {versionA}</div>
                            <div className="architecture-graph">
                                {sourceA && (
                                    <DiffGraph
                                        key={`a-${versionA}`}
                                        source={sourceA}
                                        sourceType={calmType}
                                        diffResult={diffResult}
                                        isFirst={true}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="architecture-panel">
                            <div className="architecture-header">Comparison: {versionB}</div>
                            <div className="architecture-graph">
                                {sourceB && (
                                    <DiffGraph
                                        key={`b-${versionB}`}
                                        source={sourceB}
                                        sourceType={calmType}
                                        diffResult={diffResult}
                                        isFirst={false}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
