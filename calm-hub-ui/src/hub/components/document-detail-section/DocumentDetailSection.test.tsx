import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DocumentDetailSection } from './DocumentDetailSection.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Data } from '../../../model/calm.js';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(function () { return mockNavigate; }),
    };
});

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => <textarea value={value} readOnly data-testid="monaco-editor" />
}));

const mockFetchStandardVersions = vi.fn();
const mockFetchFlowVersions = vi.fn();
const mockFetchVersionsByCustomId = vi.fn();

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return {
        fetchStandardVersions: mockFetchStandardVersions,
        fetchFlowVersions: mockFetchFlowVersions,
        fetchVersionsByCustomId: mockFetchVersionsByCustomId,
    }; }),
}));

describe('DocumentDetailSection', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockFetchStandardVersions.mockClear().mockResolvedValue([]);
        mockFetchFlowVersions.mockClear().mockResolvedValue([]);
        mockFetchVersionsByCustomId.mockClear().mockResolvedValue([]);
    });

    it('renders null when data is undefined', () => {
        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={undefined} />
            </MemoryRouter>
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders Patterns with correct icon', () => {
        const data: Data = {
            id: 'test-pattern',
            version: '1.0.0',
            name: 'my-namespace',
            calmType: 'Patterns',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('my-namespace');
        expect(heading).toHaveTextContent('test-pattern');
        expect(heading).toHaveTextContent('1.0.0');
    });

    it('renders Flows with correct icon', () => {
        const data: Data = {
            id: 'test-flow',
            version: '2.0.0',
            name: 'flow-namespace',
            calmType: 'Flows',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('flow-namespace');
        expect(heading).toHaveTextContent('test-flow');
        expect(heading).toHaveTextContent('2.0.0');
    });

    it('renders JsonRenderer with correct data', () => {
        const data: Data = {
            id: 'test-id',
            version: '1.0.0',
            name: 'test-namespace',
            calmType: 'Patterns',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const textarea = screen.getByTestId('monaco-editor');
        expect(textarea).toHaveValue(JSON.stringify(data, null, 2));
    });

    it('shows version dropdown for Standards when multiple versions are available', async () => {
        mockFetchStandardVersions.mockResolvedValue(['2.0.0', '1.0.0']);

        const data: Data = {
            id: '42',
            version: '2.0.0',
            name: 'test-ns',
            calmType: 'Standards',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('combobox', { name: 'Version' })).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox', { name: 'Version' });
        expect(select).toHaveValue('2.0.0');
        const options = screen.getAllByRole('option');
        expect(options.map((o) => o.textContent)).toEqual(['2.0.0', '1.0.0']);
    });

    it('navigates to the selected version when version changes for Standards', async () => {
        mockFetchStandardVersions.mockResolvedValue(['2.0.0', '1.0.0']);

        const data: Data = {
            id: '42',
            version: '2.0.0',
            name: 'test-ns',
            calmType: 'Standards',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('combobox', { name: 'Version' })).toBeInTheDocument();
        });

        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Version' }), '1.0.0');

        expect(mockNavigate).toHaveBeenCalledWith('/test-ns/standards/42/1.0.0');
    });

    it('shows version dropdown for Flows when multiple versions are available', async () => {
        mockFetchFlowVersions.mockResolvedValue(['3.0.0', '2.0.0', '1.0.0']);

        const data: Data = {
            id: '99',
            version: '3.0.0',
            name: 'flow-ns',
            calmType: 'Flows',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('combobox', { name: 'Version' })).toBeInTheDocument();
        });

        const options = screen.getAllByRole('option');
        expect(options.map((o) => o.textContent)).toEqual(['3.0.0', '2.0.0', '1.0.0']);
    });

    it('uses fetchVersionsByCustomId when the resource ID is a slug', async () => {
        mockFetchVersionsByCustomId.mockResolvedValue(['2.0.0', '1.0.0']);

        const data: Data = {
            id: 'my-payment-standard',
            version: '2.0.0',
            name: 'test-ns',
            calmType: 'Standards',
            data: undefined,
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByRole('combobox', { name: 'Version' })).toBeInTheDocument();
        });

        expect(mockFetchVersionsByCustomId).toHaveBeenCalledWith('test-ns', 'my-payment-standard');
        expect(mockFetchStandardVersions).not.toHaveBeenCalled();
    });
});
