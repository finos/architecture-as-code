import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NodesAndRelationshipsDiffResult } from '@finos/calm-models/diff';
import { InlineDiffSummary } from './InlineDiffSummary.js';

const emptyDiff: NodesAndRelationshipsDiffResult = {
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

describe('InlineDiffSummary', () => {
    it('shows an obligation change as a modification', () => {
        render(
            <InlineDiffSummary
                diffResult={{
                    ...emptyDiff,
                    obligationChanged: {
                        nodes: [{ item: { 'unique-id': 'cache', 'node-type': 'database' }, from: 'required', to: 'catalogue' }],
                        relationships: [{ item: { 'unique-id': 'r1' }, from: 'catalogue', to: 'alternative' }],
                    },
                }}
            />
        );
        expect(screen.getByText('NODES MODIFIED (1)')).toBeInTheDocument();
        expect(screen.getByText('(required → catalogue)')).toBeInTheDocument();
        expect(screen.getByText('RELATIONSHIPS MODIFIED (1)')).toBeInTheDocument();
        expect(screen.getByText('(catalogue → alternative)')).toBeInTheDocument();
    });

    it('shows the obligation change of a modified node on its one pill', () => {
        const original = { 'unique-id': 'cache', 'node-type': 'service' };
        const updated = { 'unique-id': 'cache', 'node-type': 'database' };
        render(
            <InlineDiffSummary
                diffResult={{
                    ...emptyDiff,
                    nodesModified: [{ original, updated }],
                    obligationChanged: {
                        nodes: [{ item: updated, from: 'required', to: 'catalogue' }],
                        relationships: [],
                    },
                }}
            />
        );
        expect(screen.getByText('NODES MODIFIED (1)')).toBeInTheDocument();
        expect(screen.getByText('(service · required → catalogue)')).toBeInTheDocument();
    });
});
