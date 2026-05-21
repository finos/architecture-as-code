import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi, Mock } from 'vitest';
import { CompareView } from './CompareView.js';
import { Data } from '../../../../model/calm.js';
import { diffArchitectures } from '@finos/calm-models/diff';

let calmServiceInstance: {
    fetchResourceByCustomId: Mock;
    fetchArchitecture: Mock;
} | undefined;

vi.mock('../../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => {
        calmServiceInstance = {
            fetchResourceByCustomId: vi.fn().mockResolvedValue({
                id: 'test-arch',
                version: '0.0.0',
                name: 'arch-namespace',
                calmType: 'Architectures',
                data: { nodes: [], relationships: [] },
            }),
            fetchArchitecture: vi.fn().mockResolvedValue({}),
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

const versions = ['2.0.0', '1.5.0', '1.0.0'];

const architectureData: Data & { calmType: 'Architectures' } = {
    id: 'test-arch',
    version: '2.0.0',
    name: 'arch-namespace',
    calmType: 'Architectures',
    data: undefined,
};

describe('CompareView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('defaults to comparing the next-older version against the current version', async () => {
        render(<CompareView data={architectureData} versions={versions} onExit={vi.fn()} />);

        await waitFor(() => {
            expect((screen.getByLabelText('Baseline version') as HTMLSelectElement).value).toBe('1.5.0');
            expect((screen.getByLabelText('Comparison version') as HTMLSelectElement).value).toBe('2.0.0');
        });
    });

    it('renders both architecture graphs and computes the diff', async () => {
        render(<CompareView data={architectureData} versions={versions} onExit={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('diff-graph-a')).toBeInTheDocument();
            expect(screen.getByTestId('diff-graph-b')).toBeInTheDocument();
            expect(screen.getByTestId('diff-panel')).toBeInTheDocument();
            expect(diffArchitectures).toHaveBeenCalled();
        });
    });

    it('auto-selects the previous version when both selectors would match', async () => {
        render(<CompareView data={architectureData} versions={versions} onExit={vi.fn()} />);

        // Defaults: baseline 1.5.0, comparison 2.0.0.
        await waitFor(() => {
            expect((screen.getByLabelText('Baseline version') as HTMLSelectElement).value).toBe('1.5.0');
        });

        // Set the comparison version to match the baseline (1.5.0) — baseline should
        // move to the adjacent (next-older) version, 1.0.0.
        fireEvent.change(screen.getByLabelText('Comparison version'), { target: { value: '1.5.0' } });

        await waitFor(() => {
            expect((screen.getByLabelText('Comparison version') as HTMLSelectElement).value).toBe('1.5.0');
            expect((screen.getByLabelText('Baseline version') as HTMLSelectElement).value).toBe('1.0.0');
        });
    });
});
