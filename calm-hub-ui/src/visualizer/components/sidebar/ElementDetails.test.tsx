import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ElementDetails } from './ElementDetails.js';
import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => (
        <textarea value={value} readOnly data-testid="monaco-editor" />
    ),
}));

describe('ElementDetails', () => {
    const mockNodeData: CalmNodeSchema = {
        'unique-id': 'node-1',
        name: 'Node 1',
        'node-type': 'type-1',
        description: 'Mock Node',
        interfaces: [
            {
                'unique-id': 'load-balancer-host-port',
                host: '[[ HOST ]]',
                port: -1,
            },
        ],
        controls: {
            cbom: {
                description: 'Control requirements for delivering patterns',
                requirements: [
                    {
                        'requirement-url':
                            'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-specification.json',
                        'config-url':
                            'https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/control-example/pre-prod-review-configuration.json',
                    },
                ],
            },
        },
    };

    const mockEdgeData: CalmRelationshipSchema = {
        'unique-id': 'edge-1',
        'relationship-type': {
            connects: {
                source: { node: 'node-1' },
                destination: { node: 'node-2' },
            },
        },
        description: 'Edge 1',
    };

    it('should display message unknown entity', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        render(<ElementDetails selectedData={{} as any} />);

        expect(screen.getByText('Unknown Selected Entity')).toBeInTheDocument();
    });

    it('should render readable relationship details by default', () => {
        render(<ElementDetails selectedData={mockEdgeData} />);

        expect(screen.getByText('Relationship')).toBeInTheDocument();
        expect(screen.getByText('Edge 1')).toBeInTheDocument();
        expect(screen.getByText('edge-1')).toBeInTheDocument();
        expect(screen.getByText('connects')).toBeInTheDocument();
    });

    it('should render readable node details by default', () => {
        render(<ElementDetails selectedData={mockNodeData} />);

        expect(screen.getByText('Node')).toBeInTheDocument();
        expect(screen.getByText('Node 1')).toBeInTheDocument();
        expect(screen.getByText('node-1')).toBeInTheDocument();
        expect(screen.getByText('Mock Node')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Readable' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show the JSON when JSON is pressed, and the readable details again after', () => {
        render(<ElementDetails selectedData={mockNodeData} />);

        fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
        expect(screen.getByTestId('monaco-editor')).toHaveValue(JSON.stringify(mockNodeData, null, 2));
        expect(screen.getByRole('button', { name: 'JSON' })).toHaveAttribute('aria-pressed', 'true');

        fireEvent.click(screen.getByRole('button', { name: 'Readable' }));
        expect(screen.getByText('Node 1')).toBeInTheDocument();
        expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
    });
});
