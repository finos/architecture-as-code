import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { DiagramSection } from './DiagramSection.js';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Data } from '../../../model/calm.js';

const calmServiceMock = {
    fetchDecoratorValues: vi.fn().mockResolvedValue([]),
    fetchVersionsByCustomId: vi.fn().mockResolvedValue(['1.0.0', '2.0.0']),
    fetchArchitectureTimeline: vi.fn().mockRejectedValue(new Error('no timeline')),
    fetchArchitectureSummaries: vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Trading System', description: '', customId: 'test-arch' }]),
    fetchPatternSummaries: vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Signup Pattern', description: '', customId: 'test-pattern' }]),
};

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(() => vi.fn()),
    };
});

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => <textarea value={value} readOnly data-testid="monaco-editor" />
}));

vi.mock('../../../visualizer/components/drawer/Drawer.js', () => ({
    Drawer: ({ data }: { data: Data }) => <div data-testid="drawer">Drawer for {data.id}</div>
}));

vi.mock('./compare/CompareView.js', () => ({
    CompareView: ({ calmType, versionA, versionB }: { calmType: string; versionA: string; versionB: string }) => (
        <div data-testid="compare-view" data-from={versionA} data-to={versionB} data-calm-type={calmType}>
            Compare
        </div>
    ),
}));

// Lightweight TimelineBar stub exposing the wiring DiagramSection passes in,
// so we can assert navigation and compare callbacks without the full UI.
vi.mock('./timeline/TimelineBar.js', () => ({
    TimelineBar: ({
        currentVersion,
        onNavigate,
        onCompare,
    }: {
        currentVersion: string;
        onNavigate: (v: string) => void;
        onCompare: (from: string, to: string) => void;
    }) => (
        <div data-testid="timeline-bar" data-current={currentVersion}>
            <button onClick={() => onNavigate('2.0.0')}>nav-2.0.0</button>
            <button onClick={() => onCompare('1.0.0', '2.0.0')}>compare</button>
        </div>
    ),
}));

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => ({
        fetchDecoratorValues: calmServiceMock.fetchDecoratorValues,
        fetchVersionsByCustomId: calmServiceMock.fetchVersionsByCustomId,
        fetchArchitectureTimeline: calmServiceMock.fetchArchitectureTimeline,
        fetchArchitectureSummaries: calmServiceMock.fetchArchitectureSummaries,
        fetchPatternSummaries: calmServiceMock.fetchPatternSummaries,
    })),
}));

const architectureData: Data & { calmType: 'Architectures' } = {
    id: 'test-arch',
    version: '1.0.0',
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

describe('DiagramSection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        calmServiceMock.fetchDecoratorValues.mockResolvedValue([]);
        calmServiceMock.fetchVersionsByCustomId.mockResolvedValue(['1.0.0', '2.0.0']);
        calmServiceMock.fetchArchitectureTimeline.mockRejectedValue(new Error('no timeline'));
    });

    describe('with architecture data', () => {
        it('renders title with namespace, type and resolved name but not the version segment', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const heading = screen.getByRole('heading');
            expect(heading).toHaveTextContent('arch-namespace');
            expect(heading).toHaveTextContent('Architecture');
            // The resolved human-readable name replaces the id in the trail.
            await waitFor(() => expect(heading).toHaveTextContent('Trading System'));
            // Version moved to the timeline bar; no version dropdown in the header.
            expect(screen.queryByLabelText('Version')).not.toBeInTheDocument();
        });

        it('renders Drawer component in diagram tab', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();
            expect(screen.getByTestId('drawer')).toHaveTextContent('Drawer for test-arch');
        });

        it('uses selected architecture id in deployment decorator target', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await screen.findByTestId('drawer');

            expect(calmServiceMock.fetchDecoratorValues).toHaveBeenCalledWith(
                'arch-namespace',
                '/calm/namespaces/arch-namespace/architectures/test-arch/versions/1-0-0',
                'deployment'
            );
        });

    });

    describe('with pattern data', () => {
        it('renders title with namespace, type and resolved name but not the version segment', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            const heading = screen.getByRole('heading');
            expect(heading).toHaveTextContent('pattern-namespace');
            expect(heading).toHaveTextContent('Pattern');
            await waitFor(() => expect(heading).toHaveTextContent('Signup Pattern'));
            expect(screen.queryByLabelText('Version')).not.toBeInTheDocument();
        });

        it('renders Drawer component in diagram tab', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();
            expect(screen.getByTestId('drawer')).toHaveTextContent('Drawer for test-pattern');
        });
    });

    describe('tab behavior', () => {
        it('renders tabs with icons', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByRole('tab', { name: /diagram/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /json/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /deployments/i })).toBeInTheDocument();
        });

        it('renders Deployments tab only for architectures, not patterns', () => {
            const { rerender } = render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );
            expect(screen.getByRole('tab', { name: /deployments/i })).toBeInTheDocument();

            rerender(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );
            expect(screen.queryByRole('tab', { name: /deployments/i })).not.toBeInTheDocument();
        });

        it('switches to Deployments tab when clicked', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('tab', { name: /deployments/i }));

            expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
            expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
        });

        it('shows diagram tab by default', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();
            expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
        });

        it('switches to JSON tab when clicked', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('tab', { name: /json/i }));

            expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
            expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
        });

        it('switches back to diagram tab when clicked', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('tab', { name: /json/i }));
            expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();

            await user.click(screen.getByRole('tab', { name: /diagram/i }));
            expect(screen.getByTestId('drawer')).toBeInTheDocument();
            expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
        });

        it('applies active styles to the selected tab', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const diagramTab = screen.getByRole('tab', { name: /diagram/i });
            const jsonTab = screen.getByRole('tab', { name: /json/i });

            expect(diagramTab).toHaveClass('tab-active');
            expect(jsonTab).not.toHaveClass('tab-active');

            await user.click(jsonTab);

            expect(jsonTab).toHaveClass('tab-active');
            expect(diagramTab).not.toHaveClass('tab-active');
        });
    });

    describe('timeline bar', () => {
        it('renders the timeline bar with the current version for both architectures and patterns', () => {
            const { rerender } = render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );
            expect(screen.getByTestId('timeline-bar')).toHaveAttribute('data-current', '1.0.0');

            rerender(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );
            expect(screen.getByTestId('timeline-bar')).toHaveAttribute('data-current', '2.0.0');
        });

        it('navigates when the timeline bar requests a version, preserving the diagram view', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);
            const user = userEvent.setup();

            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByText('nav-2.0.0'));

            expect(navigate).toHaveBeenCalledWith('/arch-namespace/architectures/test-arch/2.0.0');
        });

        it('keeps the timeline bar visible across tabs', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('timeline-bar')).toBeInTheDocument();
            await user.click(screen.getByRole('tab', { name: /json/i }));
            expect(screen.getByTestId('timeline-bar')).toBeInTheDocument();
        });
    });

    describe('compare wiring', () => {
        it('enters the diff view when the timeline bar starts a compare, seeding the versions', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();

            await user.click(screen.getByText('compare'));

            const compareView = screen.getByTestId('compare-view');
            expect(compareView).toBeInTheDocument();
            expect(compareView).toHaveAttribute('data-from', '1.0.0');
            expect(compareView).toHaveAttribute('data-to', '2.0.0');
            expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
            // The bar remains visible in the diff state.
            expect(screen.getByTestId('timeline-bar')).toBeInTheDocument();
        });

        it('enters compare for a pattern too', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            await user.click(screen.getByText('compare'));
            expect(screen.getByTestId('compare-view')).toBeInTheDocument();
        });

        it('returns to the single view when the timeline bar navigates to a version', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByText('compare'));
            expect(screen.getByTestId('compare-view')).toBeInTheDocument();

            await user.click(screen.getByText('nav-2.0.0'));
            expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument();
            expect(screen.getByTestId('drawer')).toBeInTheDocument();
        });
    });
});
