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
const mockFetchArchitectureSummaries = vi.fn();

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return {
        fetchStandardVersions: mockFetchStandardVersions,
        fetchFlowVersions: mockFetchFlowVersions,
        fetchVersionsByCustomId: mockFetchVersionsByCustomId,
        fetchArchitectureSummaries: mockFetchArchitectureSummaries,
    }; }),
}));

describe('DocumentDetailSection', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockFetchStandardVersions.mockClear().mockResolvedValue([]);
        mockFetchFlowVersions.mockClear().mockResolvedValue([]);
        mockFetchVersionsByCustomId.mockClear().mockResolvedValue([]);
        mockFetchArchitectureSummaries.mockClear().mockResolvedValue([]);
    });

    it('renders null when data is undefined', () => {
        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={undefined} />
            </MemoryRouter>
        );
        expect(container.firstChild).toBeNull();
    });

    // Regression: the live page mounts this component with data=undefined while
    // the resource loads, then re-renders the SAME instance with data. A hook
    // placed after the `if (!data) return null` guard changes the hook count
    // between those two renders and crashes React. This exercises that transition.
    it('does not crash when data changes from undefined to a Flow', async () => {
        const flowData: Data = {
            id: '4',
            version: '1.0.0',
            name: 'finos',
            calmType: 'Flows',
            data: {
                'unique-id': 'flow-4',
                name: 'Payment Flow',
                description: 'Test flow',
                transitions: [
                    { 'relationship-unique-id': 'a-to-b', 'sequence-number': 1, description: 'A calls B' },
                ],
            },
        };

        const { rerender } = render(
            <MemoryRouter>
                <DocumentDetailSection data={undefined} />
            </MemoryRouter>
        );

        expect(() =>
            rerender(
                <MemoryRouter>
                    <DocumentDetailSection data={flowData} />
                </MemoryRouter>
            )
        ).not.toThrow();

        // The name shows in the breadcrumb. The diagram no longer repeats it.
        await waitFor(() => expect(screen.getAllByText('Payment Flow').length).toBeGreaterThan(0));
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
        // The version is no longer in the header. The timeline bar shows it.
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
        // The version is no longer in the header. The timeline bar shows it.
    });

    it('shows the flow name and a "Flow" type label in the breadcrumb', () => {
        const data: Data = {
            id: '4',
            version: '1.0.0',
            name: 'finos',
            calmType: 'Flows',
            data: {
                'unique-id': 'flow-4',
                name: 'Payment Processing',
                description: 'Test flow',
                transitions: [],
            },
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const heading = screen.getByRole('heading');
        expect(heading).toHaveTextContent('finos');
        expect(heading).toHaveTextContent('Flow');
        // The human-readable flow name replaces the numeric id in the trail.
        expect(heading).toHaveTextContent('Payment Processing');
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

    it('shows the version timeline for Standards when multiple versions are available', async () => {
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

        // Version browsing moved to the timeline bar, matching the architecture
        // view. The header no longer renders a version dropdown.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Moment 2.0.0' })).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Moment 1.0.0' })).toBeInTheDocument();
        expect(screen.queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
    });

    it('navigates to the selected version when a timeline moment is clicked for Standards', async () => {
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
            expect(screen.getByRole('button', { name: 'Moment 1.0.0' })).toBeInTheDocument();
        });

        await userEvent.click(screen.getByRole('button', { name: 'Moment 1.0.0' }));

        expect(mockNavigate).toHaveBeenCalledWith('/test-ns/standards/42/1.0.0');
    });

    it('shows the version timeline for Flows when multiple versions are available', async () => {
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
            expect(screen.getByRole('button', { name: 'Moment 3.0.0' })).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Moment 2.0.0' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Moment 1.0.0' })).toBeInTheDocument();
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

        // isSlug ids still fetch via fetchVersionsByCustomId; assert on the
        // timeline moment now that the header dropdown is gone.
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Moment 2.0.0' })).toBeInTheDocument();
        });

        expect(mockFetchVersionsByCustomId).toHaveBeenCalledWith('test-ns', 'my-payment-standard', 'Standards');
        expect(mockFetchStandardVersions).not.toHaveBeenCalled();
    });
});
