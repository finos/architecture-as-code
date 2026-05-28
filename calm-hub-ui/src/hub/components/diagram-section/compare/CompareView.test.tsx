import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { DiffResult } from '@finos/calm-models/diff';
import { CompareView } from './CompareView.js';

vi.mock('../../../../diff/components/DiffGraph.js', () => ({
    DiffGraph: ({ isFirst, sourceType }: { isFirst: boolean; sourceType: string }) => (
        <div data-testid={isFirst ? 'diff-graph-a' : 'diff-graph-b'} data-source-type={sourceType}>
            graph
        </div>
    ),
}));

const emptyDiff: DiffResult = {
    nodesAdded: [],
    nodesRemoved: [],
    nodesModified: [],
    nodesRenamed: [],
    nodesSame: [],
    edgesAdded: [],
    edgesRemoved: [],
    edgesModified: [],
    edgesRenamed: [],
    edgesSame: [],
};

const sourceA = { nodes: [], relationships: [] };
const sourceB = { nodes: [], relationships: [] };

describe('CompareView', () => {
    it('renders Baseline / Comparison headers and both architecture graphs', () => {
        render(
            <CompareView
                calmType="Architectures"
                versionA="1.0.0"
                versionB="2.0.0"
                sourceA={sourceA}
                sourceB={sourceB}
                diffResult={emptyDiff}
            />
        );

        expect(screen.getByText('Baseline: 1.0.0')).toBeInTheDocument();
        expect(screen.getByText('Comparison: 2.0.0')).toBeInTheDocument();
        expect(screen.getByTestId('diff-graph-a')).toBeInTheDocument();
        expect(screen.getByTestId('diff-graph-b')).toBeInTheDocument();
    });

    it('passes the calmType through to both DiffGraphs', () => {
        render(
            <CompareView
                calmType="Patterns"
                versionA="1.0.0"
                versionB="2.0.0"
                sourceA={sourceA}
                sourceB={sourceB}
                diffResult={emptyDiff}
            />
        );

        expect(screen.getByTestId('diff-graph-a')).toHaveAttribute('data-source-type', 'Patterns');
        expect(screen.getByTestId('diff-graph-b')).toHaveAttribute('data-source-type', 'Patterns');
    });

    it('no longer renders the right-side DiffPanel — its content moved to the timeline', () => {
        render(
            <CompareView
                calmType="Architectures"
                versionA="1.0.0"
                versionB="2.0.0"
                sourceA={sourceA}
                sourceB={sourceB}
                diffResult={emptyDiff}
            />
        );

        expect(screen.queryByTestId('diff-panel')).not.toBeInTheDocument();
    });

    it('renders the error in place of the panes when provided', () => {
        render(
            <CompareView
                calmType="Architectures"
                versionA="1.0.0"
                versionB="2.0.0"
                sourceA={null}
                sourceB={null}
                diffResult={null}
                error="boom"
            />
        );

        expect(screen.getByTestId('compare-error')).toHaveTextContent('boom');
        expect(screen.queryByTestId('diff-graph-a')).not.toBeInTheDocument();
    });
});
