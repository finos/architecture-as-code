import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import testArchitectures from '../../fixtures/diff-test-architectures.json' with { type: 'json' };
import { DiffResult } from '../../model/diff.js';
import { DiffGraph } from './DiffGraph.js';

describe('DiffGraph', () => {
    it('should render without crashing', () => {
        const architecture = testArchitectures.baseArchitecture;
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesSame: architecture.nodes,
            nodesRenamed: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesSame: architecture.relationships,
            edgesRenamed: [],
        };

        render(
            <DiffGraph
                architecture={architecture}
                diffResult={diffResult}
                isFirst={true}
            />
        );

        // Check if nodes are rendered by looking for names
        testArchitectures.baseArchitecture.nodes.forEach(node => {
            expect(screen.getByText(node.name)).toBeInTheDocument();
        });

        // Expect there to be as many edges rendered as in the architecture
        screen.findAllByRole('edge').then(edges => {
            expect(edges).toHaveLength(testArchitectures.baseArchitecture.relationships.length);
        });
    });

    it('should handle empty architecture gracefully', () => {
        const emptyArchitecture = {
            nodes: [],
            relationships: [],
        };
        const diffResult: DiffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesSame: [],
            nodesRenamed: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesSame: [],
            edgesRenamed: [],
        };

        render(
            <DiffGraph
                architecture={emptyArchitecture}
                diffResult={diffResult}
                isFirst={true}
            />
        );

        screen.findAllByRole('node').then(nodes => {
            expect(nodes).toHaveLength(0);
        });
        screen.findAllByRole('edge').then(edges => {
            expect(edges).toHaveLength(0);
        });
    });
});