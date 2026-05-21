import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { DiagramSection } from './DiagramSection.js';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { Data } from '../../../model/calm.js';

const calmServiceMock = {
    fetchDecoratorValues: vi.fn().mockResolvedValue([]),
    fetchVersionsByCustomId: vi.fn().mockResolvedValue(['1.0.0', '2.0.0']),
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
    CompareView: ({ data }: { data: Data }) => <div data-testid="compare-view">Compare for {data.id}</div>
}));

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(() => ({
        fetchDecoratorValues: calmServiceMock.fetchDecoratorValues,
        fetchVersionsByCustomId: calmServiceMock.fetchVersionsByCustomId,
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
    });

    describe('with architecture data', () => {
        it('renders title with namespace, id, and version', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const heading = screen.getByRole('heading');
            expect(heading).toHaveTextContent('arch-namespace');
            expect(heading).toHaveTextContent('test-arch');
            expect(heading).toHaveTextContent('1.0.0');
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
        it('renders title with namespace, id, and version', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            const heading = screen.getByRole('heading');
            expect(heading).toHaveTextContent('pattern-namespace');
            expect(heading).toHaveTextContent('test-pattern');
            expect(heading).toHaveTextContent('2.0.0');
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

    describe('version selector', () => {
        it('renders the version as a dropdown listing all versions', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const select = (await screen.findByLabelText('Version')) as HTMLSelectElement;
            expect(select.value).toBe('1.0.0');
            expect(Array.from(select.querySelectorAll('option')).map((o) => o.value)).toEqual([
                '2.0.0',
                '1.0.0',
            ]);
        });

        it('navigates to the selected version', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);

            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const select = await screen.findByLabelText('Version');
            fireEvent.change(select, { target: { value: '2.0.0' } });

            await waitFor(() => {
                expect(navigate).toHaveBeenCalledWith('/arch-namespace/architectures/test-arch/2.0.0');
            });
        });
    });

    describe('compare mode', () => {
        it('renders a Compare button for both architectures and patterns', () => {
            const { rerender } = render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );
            expect(screen.getByRole('button', { name: /compare versions/i })).toBeInTheDocument();

            rerender(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );
            expect(screen.getByRole('button', { name: /compare versions/i })).toBeInTheDocument();
        });

        it('enters compare mode for a pattern when Compare is clicked', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('button', { name: /compare versions/i }));

            expect(screen.getByTestId('compare-view')).toBeInTheDocument();
        });

        it('enters compare mode when Compare is clicked', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: /compare versions/i }));

            expect(screen.getByTestId('compare-view')).toBeInTheDocument();
            expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
        });

        it('toggles back to the regular view when Compare is clicked again', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const compareButton = screen.getByRole('button', { name: /compare versions/i });
            await user.click(compareButton);
            expect(screen.getByTestId('compare-view')).toBeInTheDocument();

            await user.click(compareButton);
            expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument();
            expect(screen.getByTestId('drawer')).toBeInTheDocument();
        });

        it('exits compare mode when a tab is clicked', async () => {
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('button', { name: /compare versions/i }));
            expect(screen.getByTestId('compare-view')).toBeInTheDocument();

            await user.click(screen.getByRole('tab', { name: /diagram/i }));
            expect(screen.queryByTestId('compare-view')).not.toBeInTheDocument();
            expect(screen.getByTestId('drawer')).toBeInTheDocument();
        });
    });
});
