import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
const mockFetchArchitectureVersions = vi.fn();
const mockFetchArchitecture = vi.fn();

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return {
        fetchStandardVersions: mockFetchStandardVersions,
        fetchFlowVersions: mockFetchFlowVersions,
        fetchVersionsByCustomId: mockFetchVersionsByCustomId,
        fetchArchitectureSummaries: mockFetchArchitectureSummaries,
        fetchArchitectureVersions: mockFetchArchitectureVersions,
        fetchArchitecture: mockFetchArchitecture,
    }; }),
}));

describe('DocumentDetailSection', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        mockFetchStandardVersions.mockClear().mockResolvedValue([]);
        mockFetchFlowVersions.mockClear().mockResolvedValue([]);
        mockFetchVersionsByCustomId.mockClear().mockResolvedValue([]);
        mockFetchArchitectureSummaries.mockClear().mockResolvedValue([]);
        mockFetchArchitectureVersions.mockClear().mockResolvedValue([]);
        mockFetchArchitecture.mockClear();
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

    it('reports when a flow namespace has no architectures', async () => {
        const data: Data = {
            id: '4',
            version: '1.0.0',
            name: 'finos',
            calmType: 'Flows',
            data: {
                'unique-id': 'flow-4',
                name: 'Payment Processing',
                description: 'Test flow',
                transitions: [{ 'relationship-unique-id': 'a-to-b', 'sequence-number': 1, description: 'Call service' }],
            },
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Architecture View' }));

        expect(await screen.findByText('No architectures found in this namespace')).toBeInTheDocument();
    });

    it('reports when no architecture matches the flow relationships', async () => {
        mockFetchArchitectureSummaries.mockResolvedValue([{ id: 1 }]);
        mockFetchArchitecture.mockResolvedValue({ data: { relationships: [{ 'unique-id': 'other' }] } });
        const data: Data = {
            id: '4', version: '1.0.0', name: 'finos', calmType: 'Flows',
            data: {
                'unique-id': 'flow-4', name: 'Payment Processing', description: 'Test flow',
                transitions: [{ 'relationship-unique-id': 'a-to-b', 'sequence-number': 1, description: 'Call service' }],
            },
        };

        render(<MemoryRouter><DocumentDetailSection data={data} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('tab', { name: 'Architecture View' }));

        expect(await screen.findByText('No matching architecture found for this flow')).toBeInTheDocument();
    });

    it('reports when the architecture lookup fails', async () => {
        mockFetchArchitectureSummaries.mockRejectedValue(new Error('Network failure'));
        const data: Data = {
            id: '4', version: '1.0.0', name: 'finos', calmType: 'Flows',
            data: {
                'unique-id': 'flow-4', name: 'Payment Processing', description: 'Test flow',
                transitions: [{ 'relationship-unique-id': 'a-to-b', 'sequence-number': 1, description: 'Call service' }],
            },
        };

        render(<MemoryRouter><DocumentDetailSection data={data} /></MemoryRouter>);
        fireEvent.click(screen.getByRole('tab', { name: 'Architecture View' }));

        expect(await screen.findByText('Failed to load architecture')).toBeInTheDocument();
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

    it('renders markdown content when data is a markdown string', () => {
        const data: Data = {
            id: 'std-123',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: '# TLS Policy\n\nAll services must use TLS 1.2+.',
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        expect(screen.getByText('All services must use TLS 1.2+.')).toBeInTheDocument();
    });

    // jsdom cannot compute the stylesheet, so assert the scoping class and the elements it styles.
    it('renders markdown elements inside the scoped markdown container', () => {
        const data: Data = {
            id: 'std-elements',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: [
                '# Heading 1',
                '## Heading 2',
                '### Heading 3',
                '#### Heading 4',
                '##### Heading 5',
                '###### Heading 6',
                'A paragraph with `inline code` and a [link](https://calm.finos.org).',
                '- item\n  - nested item',
                '1. first\n2. second',
                '> A quote',
                '```\nconst x = 1;\n```',
                '---',
            ].join('\n\n'),
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const markdown = container.querySelector('.calm-markdown');
        expect(markdown).not.toBeNull();
        expect(markdown).not.toHaveClass('prose');
        for (const selector of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul ul li', 'ol li', 'p code', 'pre code', 'blockquote', 'a', 'hr']) {
            expect(markdown!.querySelector(selector), selector).not.toBeNull();
        }
    });

    it('renders GitHub Flavored Markdown tables, strikethrough and task lists', () => {
        const data: Data = {
            id: 'std-gfm',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: [
                '| Control | Owner |',
                '| ------- | ----- |',
                '| TLS 1.2 | Platform |',
                '',
                'The ~~old~~ rule. See https://calm.finos.org.',
                '',
                '- [x] done',
            ].join('\n'),
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const markdown = container.querySelector('.calm-markdown');
        const region = screen.getByRole('region', { name: 'Table' });
        expect(region).toHaveAttribute('tabindex', '0');
        expect(region.querySelector('table thead th')).toHaveTextContent('Control');
        expect(region.querySelector('table tbody td')).toHaveTextContent('TLS 1.2');
        expect(markdown!.querySelector('del')).toHaveTextContent('old');
        expect(screen.getByRole('link', { name: 'https://calm.finos.org' })).toHaveAttribute('href', 'https://calm.finos.org');
        const checkbox = markdown!.querySelector('li.task-list-item input[type="checkbox"]');
        expect(checkbox).toBeChecked();
        expect(checkbox).toBeDisabled();
    });

    // The app uses a HashRouter, so following "#user-content-fn-1" would change the route.
    it('scrolls to a footnote instead of following its in-page link', () => {
        const scrollIntoView = vi.fn();
        Element.prototype.scrollIntoView = scrollIntoView;
        const data: Data = {
            id: 'std-footnote',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: 'A claim.[^1]\n\n[^1]: The source.',
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        const reference = container.querySelector<HTMLAnchorElement>('a[data-footnote-ref]')!;
        expect(reference).toHaveAttribute('href', '#user-content-fn-1');
        const followed = fireEvent.click(reference);

        expect(followed).toBe(false);
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView.mock.contexts[0]).toBe(container.querySelector('#user-content-fn-1'));
    });

    it('leaves external markdown links to the browser', () => {
        const data: Data = {
            id: 'std-link',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: 'See the [guide](https://calm.finos.org).',
        };

        render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        // Runs after React's handler; it stops jsdom, which cannot navigate.
        let prevented: boolean | undefined;
        const afterReact = (event: Event) => {
            prevented = event.defaultPrevented;
            event.preventDefault();
        };
        document.addEventListener('click', afterReact);
        fireEvent.click(screen.getByRole('link', { name: 'guide' }));
        document.removeEventListener('click', afterReact);

        expect(prevented).toBe(false);
    });

    it('shows display name from markdown heading in breadcrumb', () => {
        const data: Data = {
            id: '12345',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: '# My Standard Name\n\nContent.',
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        expect(container.textContent).toContain('My Standard Name');
    });

    it('shows type label in breadcrumb', () => {
        const data: Data = {
            id: 'std-1',
            version: 'latest',
            name: 'fae-calm',
            calmType: 'Standards',
            data: '# Test\n\nBody.',
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        expect(container.textContent).toContain('Standard');
    });

    it('renders a JSON string with leading whitespace as JSON, not markdown', () => {
        const data: Data = {
            id: 'std-json',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: '  \n{"unique-id": "std-json"}',
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        expect(container.querySelector('.calm-markdown')).toBeNull();
    });

    it('falls back to the document id in the breadcrumb when markdown has no heading', () => {
        const data: Data = {
            id: 'std-no-heading',
            version: 'latest',
            name: 'test-ns',
            calmType: 'Standards',
            data: 'Plain prose with no heading.',
        };

        const { container } = render(
            <MemoryRouter>
                <DocumentDetailSection data={data} />
            </MemoryRouter>
        );

        expect(container.querySelector('.calm-markdown')).not.toBeNull();
        expect(container.textContent).toContain('std-no-heading');
    });
});
