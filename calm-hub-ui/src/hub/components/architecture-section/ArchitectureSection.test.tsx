import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { ArchitectureSection } from './ArchitectureSection.js';
import { describe, it, expect, vi } from 'vitest';
import { Data } from '../../../model/calm.js';

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

describe('ArchitectureSection', () => {
    const architectureData: Data & { calmType: 'Architectures' } = {
        id: 'test-arch',
        version: '1.0.0',
        name: 'arch-namespace',
        calmType: 'Architectures',
        data: undefined,
    };

    it('renders architecture title with namespace, id, and version', () => {
        render(
            <MemoryRouter>
                <ArchitectureSection data={architectureData} />
            </MemoryRouter>
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('arch-namespace');
        expect(heading).toHaveTextContent('test-arch');
        expect(heading).toHaveTextContent('1.0.0');
    });

    it('renders tabs with icons', () => {
        render(
            <MemoryRouter>
                <ArchitectureSection data={architectureData} />
            </MemoryRouter>
        );

        expect(screen.getByRole('tab', { name: /diagram/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /json/i })).toBeInTheDocument();
    });

    it('shows diagram tab by default', () => {
        render(
            <MemoryRouter>
                <ArchitectureSection data={architectureData} />
            </MemoryRouter>
        );

        expect(screen.getByTestId('drawer')).toBeInTheDocument();
        expect(screen.getByTestId('drawer')).toHaveTextContent('Drawer for test-arch');
    });

    it('switches to JSON tab when clicked', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <ArchitectureSection data={architectureData} />
            </MemoryRouter>
        );

        const jsonTab = screen.getByRole('tab', { name: /json/i });
        await user.click(jsonTab);

        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
        expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
    });

    it('switches back to diagram tab when clicked', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <ArchitectureSection data={architectureData} />
            </MemoryRouter>
        );

        const jsonTab = screen.getByRole('tab', { name: /json/i });
        await user.click(jsonTab);

        expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();

        const diagramTab = screen.getByRole('tab', { name: /diagram/i });
        await user.click(diagramTab);

        expect(screen.getByTestId('drawer')).toBeInTheDocument();
        expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
    });

    it('applies active styles to the selected tab', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter>
                <ArchitectureSection data={architectureData} />
            </MemoryRouter>
        );

        const diagramTab = screen.getByRole('tab', { name: /diagram/i });
        const jsonTab = screen.getByRole('tab', { name: /json/i });

        // Diagram tab should be active by default
        expect(diagramTab).toHaveClass('tab-active');
        expect(jsonTab).not.toHaveClass('tab-active');

        // Click JSON tab
        await user.click(jsonTab);

        expect(jsonTab).toHaveClass('tab-active');
        expect(diagramTab).not.toHaveClass('tab-active');
    });
});
