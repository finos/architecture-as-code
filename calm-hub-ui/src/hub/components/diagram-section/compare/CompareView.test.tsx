import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi, Mock } from 'vitest';
import { CompareView } from './CompareView.js';
import { Data } from '../../../../model/calm.js';
import { diffArchitectures } from '@finos/calm-models/diff';

let calmServiceInstance: {
    fetchVersionsByCustomId: Mock;
    fetchArchitectureVersions: Mock;
    fetchPatternVersions: Mock;
    fetchResourceByCustomId: Mock;
    fetchArchitecture: Mock;
    fetchPattern: Mock;
} | undefined;

vi.mock('../../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => {
        calmServiceInstance = {
            fetchVersionsByCustomId: vi.fn().mockResolvedValue(['1.0.0', '2.0.0', '1.5.0']),
            fetchArchitectureVersions: vi.fn().mockResolvedValue([]),
            fetchPatternVersions: vi.fn().mockResolvedValue(['1.0.0', '2.0.0']),
            fetchResourceByCustomId: vi.fn().mockResolvedValue({
                id: 'test-arch',
                version: '0.0.0',
                name: 'arch-namespace',
                calmType: 'Architectures',
                data: { nodes: [], relationships: [] },
            }),
            fetchArchitecture: vi.fn().mockResolvedValue({}),
            fetchPattern: vi.fn().mockResolvedValue({}),
        };
        return calmServiceInstance;
    }),
}));

vi.mock('../../../../diff/components/DiffGraph.js', () => ({
    DiffGraph: ({ isFirst }: { isFirst: boolean }) => (
        <div data-testid={isFirst ? 'diff-graph-a' : 'diff-graph-b'}>graph</div>
    ),
}));

vi.mock('../../../../diff/components/DiffPanel.js', () => ({
    DiffPanel: () => <div data-testid="diff-panel">panel</div>,
}));

vi.mock('@finos/calm-models/diff', () => ({
    diffArchitectures: vi.fn(() => ({ marker: 'diff' })),
}));

const architectureData: Data & { calmType: 'Architectures' } = {
    id: 'test-arch',
    version: '2.0.0',
    name: 'arch-namespace',
    calmType: 'Architectures',
    data: undefined,
};

const patternData: Data & { calmType: 'Patterns' } = {
    id: 'test-pattern',
    version: '2.0.0',
    name: 'pattern-namespace',
    calmType: 'Patterns',
    data: undefined,
};

describe('CompareView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('defaults to comparing the next-older version against the current version', async () => {
        render(<CompareView data={architectureData} onExit={vi.fn()} />);

        await waitFor(() => {
            expect((screen.getByLabelText('Baseline version') as HTMLSelectElement).value).toBe('1.5.0');
            expect((screen.getByLabelText('Comparison version') as HTMLSelectElement).value).toBe('2.0.0');
        });
    });

    it('renders both architecture graphs and computes the diff', async () => {
        render(<CompareView data={architectureData} onExit={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('diff-graph-a')).toBeInTheDocument();
            expect(screen.getByTestId('diff-graph-b')).toBeInTheDocument();
            expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
            expect(diffArchitectures).toHaveBeenCalled();
        });
    });

    it('shows a coming-soon placeholder for patterns and does not diff', async () => {
        render(<CompareView data={patternData} onExit={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('pattern-compare-placeholder')).toBeInTheDocument();
        });
        expect(diffArchitectures).not.toHaveBeenCalled();
        expect(calmServiceInstance?.fetchResourceByCustomId).not.toHaveBeenCalled();
    });
});
