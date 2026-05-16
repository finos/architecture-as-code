import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import testArchitectures from '../../fixtures/diff-test-architectures.json' with { type: 'json' };
import { DiffGraphPanel } from './DiffGraphPanel.js';

describe('DiffGraphPanel', () => {
    it('should render file upload area when no architectures are loaded', () => {
        render(
            <DiffGraphPanel
                archA={null}
                archB={null}
                diffResult={null}
                onFileLoad={() => {}}
            />
        );
        expect(screen.getByText('CALM Architecture Diff')).toBeInTheDocument();
        expect(screen.getByText('Upload two CALM architecture JSON files to compare them and see the differences.')).toBeInTheDocument();
        expect(screen.getByText('First Architecture')).toBeInTheDocument();
        expect(screen.getByText('Second Architecture')).toBeInTheDocument();
    });

    it('should render DiffGraph when architectures and diffResult are provided', () => {
        const diffResult = {
            nodesAdded: [],
            nodesRemoved: [],
            nodesModified: [],
            nodesSame: testArchitectures.baseArchitecture.nodes,
            nodesRenamed: [],
            edgesAdded: [],
            edgesRemoved: [],
            edgesModified: [],
            edgesSame: testArchitectures.baseArchitecture.relationships,
            edgesRenamed: [],
        };
        render(
            <DiffGraphPanel
                archA={testArchitectures.baseArchitecture}
                archB={testArchitectures.baseArchitecture}
                diffResult={diffResult}
                onFileLoad={() => {}}
            />
        );
        // Check if DiffGraph is rendered by looking for node names
        testArchitectures.baseArchitecture.nodes.forEach(node => {
            screen.getAllByText(node.name).forEach(element => {
                expect(element).toBeInTheDocument();
            });
        });
        // Check if edges are rendered by looking for relationships
        screen.findAllByRole('edge').then(edges => {
            expect(edges).toHaveLength(testArchitectures.baseArchitecture.relationships.length*2); // Each edge should be rendered in both graphs
        });
    });

    it('should handle null diffResult gracefully', () => {
        render(
            <DiffGraphPanel
                archA={testArchitectures.baseArchitecture}
                archB={testArchitectures.baseArchitecture}
                diffResult={null}
                onFileLoad={() => {}}
            />
        );
        // Should still render the architecture graphs without diff highlights
        testArchitectures.baseArchitecture.nodes.forEach(node => {
            screen.getAllByText(node.name).forEach(element => {
                expect(element).toBeInTheDocument();
            });
        });
        screen.findAllByRole('edge').then(edges => {
            expect(edges).toHaveLength(testArchitectures.baseArchitecture.relationships.length*2); // Each edge should be rendered in both graphs
        });
    });
});