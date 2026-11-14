import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { DiagramSection } from './DiagramSection.js';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { BreadcrumbItem, Data } from '../../../model/calm.js';
import { saveNodePositions } from '../../../visualizer/services/node-position-service.js';
import type { Node } from '@xyflow/react';

const DECORATOR_TARGET = '/api/calm/namespaces/arch-namespace/architectures/42/versions/1-0-0';

const calmServiceMock = {
    resolveArchitectureVersionTarget: vi.fn().mockResolvedValue(DECORATOR_TARGET),
    fetchDecoratorsForTarget: vi.fn().mockResolvedValue([]),
    fetchVersionsByCustomId: vi.fn().mockResolvedValue(['1.0.0', '2.0.0']),
    fetchArchitectureTimeline: vi.fn().mockRejectedValue(new Error('no timeline')),
    fetchArchitectureSummaries: vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Trading System', description: '', customId: 'test-arch' }]),
    fetchPatternSummaries: vi
        .fn()
        .mockResolvedValue([{ id: 1, name: 'Signup Pattern', description: '', customId: 'test-pattern' }]),
    fetchMappings: vi
        .fn()
        .mockResolvedValue([{ namespace: 'arch-namespace', customId: 'test-arch', resourceType: 'Architectures', numericId: 42 }]),
};

const implementationServiceMock = {
    fetchImplementations: vi.fn().mockResolvedValue([]),
};

const layoutServiceMock = {
    getDefaultLayout: vi.fn().mockResolvedValue(null),
    saveDefaultLayout: vi.fn().mockResolvedValue(undefined),
};

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: vi.fn(function () { return vi.fn(); }),
    };
});

vi.mock('@monaco-editor/react', () => ({
    Editor: ({ value }: { value: string }) => <textarea value={value} readOnly data-testid="monaco-editor" />
}));

vi.mock('../../../visualizer/components/drawer/Drawer.js', () => ({
    // Exposes a button that invokes onPositionsChange the same way the real
    // graph does after every apply (initial parse AND drag-end), so tests can
    // simulate a drag without pulling in the full ReactFlow tree.
    Drawer: ({
        data,
        decorators,
        onPositionsChange,
        onDroppedFileChange,
        onOpenView,
    }: {
        data: Data;
        decorators?: { uniqueId: string }[];
        onPositionsChange?: (positions: { id: string; position: { x: number; y: number } }[]) => void;
        onDroppedFileChange?: (dropped: boolean) => void;
        onOpenView?: (view: { id: string; label: string; match: { type?: string; schema?: string } }) => void;
    }) => (
        <div data-testid="drawer">
            Drawer for {data.id}
            <span data-testid="drawer-decorators">{decorators?.map((d) => d.uniqueId).join(' ') || '(none)'}</span>
            <button
                onClick={() => onPositionsChange?.([{ id: 'node-1', position: { x: 1, y: 2 } }])}
            >
                simulate-drag-report
            </button>
            <button onClick={() => onDroppedFileChange?.(true)}>simulate-file-drop</button>
            <button onClick={() => onOpenView?.({ id: 'deployment', label: 'Deployments', match: { type: 'deployment' } })}>
                simulate-open-view
            </button>
            <button onClick={() => onOpenView?.({ id: 'scan', label: 'Scans', match: { schema: 'https://example.org/scan.json' } })}>
                simulate-open-schema-view
            </button>
            <button
                onClick={() => onOpenView?.({ id: 'scan', label: 'Scans', match: { type: 'observability', schema: 'https://example.org/scan.json' } })}
            >
                simulate-open-type-and-schema-view
            </button>
        </div>
    ),
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
        moments,
        onNavigate,
        onCompare,
    }: {
        currentVersion: string;
        moments: unknown[];
        onNavigate: (v: string) => void;
        onCompare: (from: string, to: string) => void;
    }) => (
        <div data-testid="timeline-bar" data-current={currentVersion} data-moments={moments.length}>
            <button onClick={() => onNavigate('2.0.0')}>nav-2.0.0</button>
            <button onClick={() => onCompare('1.0.0', '2.0.0')}>compare</button>
        </div>
    ),
}));

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return {
        resolveArchitectureVersionTarget: calmServiceMock.resolveArchitectureVersionTarget,
        fetchDecoratorsForTarget: calmServiceMock.fetchDecoratorsForTarget,
        fetchVersionsByCustomId: calmServiceMock.fetchVersionsByCustomId,
        fetchArchitectureTimeline: calmServiceMock.fetchArchitectureTimeline,
        fetchArchitectureSummaries: calmServiceMock.fetchArchitectureSummaries,
        fetchPatternSummaries: calmServiceMock.fetchPatternSummaries,
        fetchMappings: calmServiceMock.fetchMappings,
    }; }),
}));

vi.mock('../../../service/pattern-implementation-service.js', () => ({
    PatternImplementationService: vi.fn().mockImplementation(function () { return {
        fetchImplementations: implementationServiceMock.fetchImplementations,
    }; }),
}));

vi.mock('../../../service/layout-service.js', () => ({
    LayoutService: vi.fn().mockImplementation(function () { return {
        getDefaultLayout: layoutServiceMock.getDefaultLayout,
        saveDefaultLayout: layoutServiceMock.saveDefaultLayout,
    }; }),
}));

const userAccessMock = { canWriteNamespace: vi.fn().mockReturnValue(false) };
vi.mock('../../../admin/context/UserAccessContext.js', () => ({
    useUserAccess: () => userAccessMock,
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
        calmServiceMock.resolveArchitectureVersionTarget.mockResolvedValue(DECORATOR_TARGET);
        calmServiceMock.fetchDecoratorsForTarget.mockResolvedValue([]);
        calmServiceMock.fetchVersionsByCustomId.mockResolvedValue(['1.0.0', '2.0.0']);
        calmServiceMock.fetchArchitectureTimeline.mockRejectedValue(new Error('no timeline'));
        implementationServiceMock.fetchImplementations.mockResolvedValue([]);
        userAccessMock.canWriteNamespace.mockReturnValue(false);
    });

    describe('used by tab', () => {
        const implementations = [{ namespace: 'finos', architectureId: 7, version: '1.2.0', customId: 'trade-capture' }];

        function renderPattern(data: Data & { calmType: 'Patterns' } = patternData) {
            return render(
                <MemoryRouter>
                    <DiagramSection data={data} />
                </MemoryRouter>
            );
        }

        it('shows the tab for a pattern, and asks by the pattern name only when the tab opens', async () => {
            const user = userEvent.setup();
            renderPattern();

            const tab = await screen.findByRole('tab', { name: 'Used by' });
            expect(implementationServiceMock.fetchImplementations).not.toHaveBeenCalled();

            await user.click(tab);

            expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledWith('pattern-namespace', 'test-pattern', '2.0.0');
        });

        it('asks by the pattern name when the route carries the numeric id', async () => {
            const user = userEvent.setup();
            renderPattern({ ...patternData, id: '1' });

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));

            expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledWith('pattern-namespace', 'test-pattern', '2.0.0');
        });

        it('does not show the tab for an architecture', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await waitFor(() => expect(calmServiceMock.fetchArchitectureSummaries).toHaveBeenCalled());
            expect(screen.queryByRole('tab', { name: /used by/i })).not.toBeInTheDocument();
            expect(implementationServiceMock.fetchImplementations).not.toHaveBeenCalled();
        });

        it('hides the tab for a pattern that has no name', async () => {
            calmServiceMock.fetchPatternSummaries.mockResolvedValueOnce([{ id: 1, name: 'Signup Pattern', description: '' }]);
            renderPattern({ ...patternData, id: '1' });

            await waitFor(() => expect(calmServiceMock.fetchPatternSummaries).toHaveBeenCalled());
            expect(screen.queryByRole('tab', { name: /used by/i })).not.toBeInTheDocument();
            expect(implementationServiceMock.fetchImplementations).not.toHaveBeenCalled();
        });

        it('says so in the panel when the hub does not support the lookup', async () => {
            implementationServiceMock.fetchImplementations.mockResolvedValue(null);
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));

            expect(await screen.findByText('Not available for this pattern.')).toBeInTheDocument();
        });

        it('says so in the panel when the lookup fails', async () => {
            implementationServiceMock.fetchImplementations.mockRejectedValue(new Error('boom'));
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));

            expect(await screen.findByText('Could not load the architectures that use this version.')).toBeInTheDocument();
        });

        it('lists the architectures when the tab is clicked', async () => {
            implementationServiceMock.fetchImplementations.mockResolvedValue(implementations);
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));

            expect(await screen.findByRole('link', { name: /trade-capture/ })).toHaveAttribute('href', '#/finos/architectures/trade-capture/1.2.0');
            expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
        });

        it('shows the number of architectures only once the tab has loaded them, and keeps it', async () => {
            implementationServiceMock.fetchImplementations.mockResolvedValue([
                { namespace: 'finos', architectureId: 7, version: '1.0.0', customId: 'trade-capture' },
                { namespace: 'finos', architectureId: 7, version: '1.1.0', customId: 'trade-capture' },
                { namespace: 'other', architectureId: 7, version: '1.0.0' },
            ]);
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));
            expect(await screen.findByRole('tab', { name: 'Used by (2)' })).toBeInTheDocument();

            await user.click(screen.getByRole('tab', { name: 'Diagram' }));
            expect(screen.getByRole('tab', { name: 'Used by (2)' })).toBeInTheDocument();
        });

        it('shows no number when the lookup fails', async () => {
            implementationServiceMock.fetchImplementations.mockRejectedValue(new Error('boom'));
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));

            expect(await screen.findByText('Could not load the architectures that use this version.')).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: 'Used by' })).toBeInTheDocument();
        });

        it('asks again when the tab opens again after a failed lookup', async () => {
            implementationServiceMock.fetchImplementations.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(implementations);
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));
            expect(await screen.findByText('Could not load the architectures that use this version.')).toBeInTheDocument();
            await user.click(screen.getByRole('tab', { name: 'Diagram' }));
            await user.click(screen.getByRole('tab', { name: 'Used by' }));

            expect(await screen.findByRole('link', { name: /trade-capture/ })).toBeInTheDocument();
            expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledTimes(2);
        });

        it('sends one request when the tab opens again on the same version', async () => {
            implementationServiceMock.fetchImplementations.mockResolvedValue(implementations);
            const user = userEvent.setup();
            renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));
            await screen.findByRole('link', { name: /trade-capture/ });
            await user.click(screen.getByRole('tab', { name: 'Diagram' }));
            await user.click(screen.getByRole('tab', { name: /^Used by/ }));

            expect(await screen.findByRole('link', { name: /trade-capture/ })).toBeInTheDocument();
            expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledTimes(1);
        });

        it('asks again for a new version, only when the tab opens', async () => {
            const user = userEvent.setup();
            const { rerender } = renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));
            await user.click(screen.getByRole('tab', { name: 'Diagram' }));
            rerender(
                <MemoryRouter>
                    <DiagramSection data={{ ...patternData, version: '1.0.0' }} />
                </MemoryRouter>
            );
            expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledTimes(1);

            await user.click(screen.getByRole('tab', { name: /^Used by/ }));

            expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledTimes(2);
            expect(implementationServiceMock.fetchImplementations).toHaveBeenLastCalledWith('pattern-namespace', 'test-pattern', '1.0.0');
        });

        it('ignores a response for a version the page has left', async () => {
            let resolveOld: (rows: typeof implementations) => void = () => {};
            implementationServiceMock.fetchImplementations
                .mockReturnValueOnce(new Promise((resolve) => (resolveOld = resolve)))
                .mockResolvedValueOnce([]);
            const user = userEvent.setup();
            const { rerender } = renderPattern();

            await user.click(await screen.findByRole('tab', { name: 'Used by' }));
            rerender(
                <MemoryRouter>
                    <DiagramSection data={{ ...patternData, version: '1.0.0' }} />
                </MemoryRouter>
            );
            expect(await screen.findByText(/No architectures use this version/)).toBeInTheDocument();
            await act(async () => resolveOld(implementations));

            await waitFor(() => expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledTimes(2));
            expect(screen.queryByRole('link', { name: /trade-capture/ })).not.toBeInTheDocument();
            expect(screen.getByText(/No architectures use this version/)).toBeInTheDocument();
        });

        it('opens on the tab from a link, once the pattern name is known', async () => {
            render(
                <MemoryRouter initialEntries={['/?tab=used-by']}>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            expect(await screen.findByText('Architectures that use this pattern version')).toBeInTheDocument();
            await waitFor(() =>
                expect(implementationServiceMock.fetchImplementations).toHaveBeenCalledWith('pattern-namespace', 'test-pattern', '2.0.0')
            );
        });

        it('does not show the panel from a link when the pattern has no name', async () => {
            calmServiceMock.fetchPatternSummaries.mockResolvedValueOnce([{ id: 1, name: 'Signup Pattern', description: '' }]);
            render(
                <MemoryRouter initialEntries={['/?tab=used-by']}>
                    <DiagramSection data={{ ...patternData, id: '1' }} />
                </MemoryRouter>
            );

            await waitFor(() => expect(calmServiceMock.fetchPatternSummaries).toHaveBeenCalled());
            expect(screen.queryByText('Architectures that use this pattern version')).not.toBeInTheDocument();
            expect(screen.queryByText('Not available for this pattern.')).not.toBeInTheDocument();
        });

        it('offers the tab in the mobile view menu', async () => {
            const restore = mockMobileViewport();
            const user = userEvent.setup();
            renderPattern();

            await waitFor(() => expect(calmServiceMock.fetchPatternSummaries).toHaveBeenCalled());
            await user.click(screen.getByRole('button', { name: /view options/i }));

            expect(await screen.findByRole('tab', { name: 'Used by' })).toBeInTheDocument();
            expect(implementationServiceMock.fetchImplementations).not.toHaveBeenCalled();
            restore();
        });
    });

    describe('decorators tab', () => {
        const deployment = {
            uniqueId: 'dep-1',
            type: 'deployment',
            target: ['/api/calm/namespaces/arch-namespace/architectures/42/versions/1-0-0'],
            appliesTo: ['api'],
            data: { status: 'completed', 'start-time': '2026-03-01T10:15:00Z' },
        };
        const observability = {
            uniqueId: 'obs-1',
            type: 'observability',
            target: ['/api/calm/namespaces/arch-namespace/architectures/42/versions/1-0-0'],
            appliesTo: ['api', 'db'],
            data: { dashboard: 'https://grafana.example.com/d/abc' },
        };
        const scan = {
            uniqueId: 'scan-1',
            type: 'observability',
            schema: 'https://example.org/scan.json',
            target: ['/api/calm/namespaces/arch-namespace/architectures/42/versions/1-0-0'],
            appliesTo: ['api'],
            data: { result: 'clean' },
        };

        function LocationProbe() {
            const location = useLocation();
            return <div data-testid="location">{location.search}</div>;
        }

        function renderArchitecture(entry = '/', props: Partial<Parameters<typeof DiagramSection>[0]> = {}) {
            return render(
                <MemoryRouter initialEntries={[entry]}>
                    <DiagramSection data={architectureData} {...props} />
                    <LocationProbe />
                </MemoryRouter>
            );
        }

        beforeEach(() => {
            calmServiceMock.fetchDecoratorsForTarget.mockResolvedValue([deployment, observability]);
        });

        it('shows the tab for an architecture, not for a pattern', () => {
            const { unmount } = renderArchitecture();
            expect(screen.getByRole('tab', { name: 'Decorators' })).toBeInTheDocument();
            unmount();

            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );
            expect(screen.queryByRole('tab', { name: 'Decorators' })).not.toBeInTheDocument();
        });

        it('lists decorators of every type when the tab opens, and writes the tab to the URL', async () => {
            const user = userEvent.setup();
            renderArchitecture();

            await user.click(screen.getByRole('tab', { name: 'Decorators' }));

            expect(await screen.findByRole('article', { name: 'deployment decorator dep-1' })).toBeInTheDocument();
            expect(screen.getByRole('article', { name: 'observability decorator obs-1' })).toBeInTheDocument();
            expect(screen.getByTestId('location')).toHaveTextContent('?tab=decorators');
            expect(screen.queryByTestId('drawer')).not.toBeInTheDocument();
        });

        it('reads the type filter from the URL', async () => {
            renderArchitecture('/?tab=decorators&type=observability');

            expect(await screen.findByRole('article', { name: 'observability decorator obs-1' })).toBeInTheDocument();
            expect(screen.queryByRole('article', { name: 'deployment decorator dep-1' })).not.toBeInTheDocument();
            expect(screen.getByRole('combobox')).toHaveValue('observability');
        });

        it('writes the type filter to the URL, and removes it for all types', async () => {
            const user = userEvent.setup();
            renderArchitecture('/?tab=decorators');

            await user.selectOptions(await screen.findByRole('combobox'), 'deployment');
            expect(screen.getByTestId('location')).toHaveTextContent('?tab=decorators&type=deployment');
            expect(screen.queryByRole('article', { name: 'observability decorator obs-1' })).not.toBeInTheDocument();

            await user.selectOptions(screen.getByRole('combobox'), '');
            expect(screen.getByTestId('location').textContent).toBe('?tab=decorators');
        });

        it('drops the type filter when another tab opens', async () => {
            const user = userEvent.setup();
            renderArchitecture('/?tab=decorators&type=deployment');

            await user.click(screen.getByRole('tab', { name: 'JSON' }));

            expect(screen.getByTestId('location').textContent).toBe('?tab=json');
        });

        it('keeps the tab and the type filter on navigation to another version', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);
            const user = userEvent.setup();
            renderArchitecture('/?tab=decorators&type=deployment&node=api');

            await user.click(screen.getByText('nav-2.0.0'));

            expect(navigate).toHaveBeenCalledWith(
                '/arch-namespace/architectures/test-arch/2.0.0?tab=decorators&type=deployment',
                expect.anything()
            );
        });

        it('says so when the decorators cannot be loaded', async () => {
            calmServiceMock.fetchDecoratorsForTarget.mockRejectedValue(new Error('boom'));
            renderArchitecture('/?tab=decorators');

            expect(await screen.findByText(/^Could not load decorators\./)).toBeInTheDocument();
        });

        it('redirects the old Deployments tab to the Decorators tab filtered to deployment', async () => {
            renderArchitecture('/?tab=deployments');

            expect(screen.getByRole('tab', { name: 'Decorators' }).className).toContain('tab-active');
            await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?tab=decorators&type=deployment'));
            expect(await screen.findByText(/dep-1/)).toBeInTheDocument();
            expect(screen.queryByText(/obs-1/)).not.toBeInTheDocument();
        });

        it('opens the Decorators tab filtered to a view from the overlay legend', async () => {
            const user = userEvent.setup();
            renderArchitecture();

            await user.click(screen.getByText('simulate-open-view'));
            expect(screen.getByTestId('location')).toHaveTextContent('?tab=decorators&type=deployment');
            expect(await screen.findByText(/dep-1/)).toBeInTheDocument();
        });

        it('opens the Decorators tab filtered to the $schema of a view that matches on $schema', async () => {
            calmServiceMock.fetchDecoratorsForTarget.mockResolvedValue([deployment, observability, scan]);
            const user = userEvent.setup();
            renderArchitecture();

            await user.click(screen.getByText('simulate-open-schema-view'));
            expect(new URLSearchParams(screen.getByTestId('location').textContent ?? '').get('schema')).toBe('https://example.org/scan.json');
            expect(await screen.findByRole('article', { name: 'observability decorator scan-1' })).toBeInTheDocument();
            expect(screen.queryByRole('article', { name: 'observability decorator obs-1' })).not.toBeInTheDocument();
            expect(screen.queryByRole('article', { name: 'deployment decorator dep-1' })).not.toBeInTheDocument();
        });

        it('moves focus to the Decorators tab content after View all, but not after a tab click', async () => {
            const user = userEvent.setup();
            renderArchitecture();

            await user.click(screen.getByText('simulate-open-view'));
            expect(await screen.findByRole('region', { name: 'Decorators' })).toHaveFocus();

            await user.click(screen.getByRole('tab', { name: 'Diagram' }));
            await user.click(screen.getByRole('tab', { name: 'Decorators' }));
            expect(screen.getByRole('region', { name: 'Decorators' })).not.toHaveFocus();
        });

        it('does not move focus again when the Decorators tab is reached some other way after View all', async () => {
            function QueryLinks() {
                const [, setSearchParams] = useSearchParams();
                return (
                    <>
                        <button onClick={() => setSearchParams({ tab: 'diagram' })}>link-diagram</button>
                        <button onClick={() => setSearchParams({ tab: 'decorators' })}>link-decorators</button>
                    </>
                );
            }
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                    <QueryLinks />
                </MemoryRouter>
            );

            await user.click(screen.getByText('simulate-open-view'));
            expect(await screen.findByRole('region', { name: 'Decorators' })).toHaveFocus();

            await user.click(screen.getByText('link-diagram'));
            await user.click(screen.getByText('link-decorators'));
            expect(await screen.findByRole('region', { name: 'Decorators' })).not.toHaveFocus();
        });

        it('filters on both the type and the $schema of a view that matches on both', async () => {
            calmServiceMock.fetchDecoratorsForTarget.mockResolvedValue([deployment, observability, scan]);
            const user = userEvent.setup();
            renderArchitecture();

            await user.click(screen.getByText('simulate-open-type-and-schema-view'));
            const query = new URLSearchParams(screen.getByTestId('location').textContent ?? '');
            expect([query.get('type'), query.get('schema')]).toEqual(['observability', 'https://example.org/scan.json']);
            expect(await screen.findByRole('article', { name: 'observability decorator scan-1' })).toBeInTheDocument();
            expect(screen.queryByRole('article', { name: 'observability decorator obs-1' })).not.toBeInTheDocument();
        });

        it('keeps the $schema filter when the type changes, and drops it on "Show all schemas"', async () => {
            calmServiceMock.fetchDecoratorsForTarget.mockResolvedValue([deployment, observability, scan]);
            const user = userEvent.setup();
            renderArchitecture('/?tab=decorators&schema=https%3A%2F%2Fexample.org%2Fscan.json');

            await user.selectOptions(await screen.findByRole('combobox'), 'observability');
            let query = new URLSearchParams(screen.getByTestId('location').textContent ?? '');
            expect([query.get('type'), query.get('schema')]).toEqual(['observability', 'https://example.org/scan.json']);

            await user.click(screen.getByRole('button', { name: 'Show all schemas' }));
            query = new URLSearchParams(screen.getByTestId('location').textContent ?? '');
            expect([query.get('type'), query.get('schema')]).toEqual(['observability', null]);
            expect(await screen.findByRole('article', { name: 'observability decorator obs-1' })).toBeInTheDocument();
        });

        it('offers the tab in the mobile view menu, selected when active', async () => {
            const restore = mockMobileViewport();
            const user = userEvent.setup();
            renderArchitecture('/?tab=decorators');

            await user.click(screen.getByRole('button', { name: /view options/i }));
            expect(await screen.findByRole('tab', { name: 'Decorators' })).toHaveAttribute('aria-selected', 'true');
            restore();
        });

        it('reports the decorators for the details drawer, and an empty list on unmount', async () => {
            const onDecoratorsChange = vi.fn();
            const { unmount } = renderArchitecture('/', { onDecoratorsChange });

            await waitFor(() => expect(onDecoratorsChange).toHaveBeenLastCalledWith([deployment, observability]));

            unmount();
            expect(onDecoratorsChange).toHaveBeenLastCalledWith([]);
        });

        it('reports an empty list while a dropped file replaces the architecture', async () => {
            const user = userEvent.setup();
            const onDecoratorsChange = vi.fn();
            renderArchitecture('/', { onDecoratorsChange });
            await waitFor(() => expect(onDecoratorsChange).toHaveBeenLastCalledWith([deployment, observability]));

            await user.click(screen.getByText('simulate-file-drop'));

            expect(onDecoratorsChange).toHaveBeenLastCalledWith([]);
        });

        it('gives the diagram, the tab and the details drawer one polled list, with one request per refresh', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            try {
                const onDecoratorsChange = vi.fn();
                renderArchitecture('/', { onDecoratorsChange });
                await waitFor(() => expect(screen.getByTestId('drawer-decorators')).toHaveTextContent('dep-1 obs-1'));
                // The report is a passive effect, which can run after the commit that waitFor saw.
                await waitFor(() => expect(onDecoratorsChange).toHaveBeenLastCalledWith([deployment, observability]));
                expect(calmServiceMock.fetchDecoratorsForTarget).toHaveBeenCalledTimes(1);

                const newer = { ...deployment, uniqueId: 'dep-2' };
                calmServiceMock.fetchDecoratorsForTarget.mockResolvedValue([deployment, newer]);
                await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

                expect(calmServiceMock.fetchDecoratorsForTarget).toHaveBeenCalledTimes(2);
                expect(screen.getByTestId('drawer-decorators')).toHaveTextContent('dep-1 dep-2');
                await waitFor(() => expect(onDecoratorsChange).toHaveBeenLastCalledWith([deployment, newer]));
            } finally {
                vi.useRealTimers();
            }
        });

        it.each([
            ['the JSON tab', '/?tab=json', false, 0],
            ['the JSON tab with the details drawer open', '/?tab=json', true, 2],
            ['the Decorators tab', '/?tab=decorators', false, 2],
            ['the diagram', '/', false, 2],
        ])('polls the decorators on %s only if something there shows them', async (_name, entry, hasDetailsPanel, calls) => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            try {
                renderArchitecture(entry, { hasDetailsPanel });
                await act(async () => { await vi.advanceTimersByTimeAsync(0); });
                await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
                expect(calmServiceMock.fetchDecoratorsForTarget).toHaveBeenCalledTimes(calls);
            } finally {
                vi.useRealTimers();
            }
        });

        it('loads the decorators at once when the diagram opens from another tab', async () => {
            const user = userEvent.setup();
            renderArchitecture('/?tab=json');
            expect(calmServiceMock.fetchDecoratorsForTarget).not.toHaveBeenCalled();

            await user.click(screen.getByRole('tab', { name: 'Diagram' }));
            await waitFor(() => expect(screen.getByTestId('drawer-decorators')).toHaveTextContent('dep-1 obs-1'));
            expect(calmServiceMock.fetchDecoratorsForTarget).toHaveBeenCalledTimes(1);
        });

        it('keeps the list when a refresh fails', async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            const error = vi.spyOn(console, 'error').mockImplementation(() => {});
            try {
                renderArchitecture('/?tab=decorators');
                expect(await screen.findByRole('article', { name: 'deployment decorator dep-1' })).toBeInTheDocument();

                calmServiceMock.fetchDecoratorsForTarget.mockRejectedValue(new Error('boom'));
                await act(async () => { await vi.advanceTimersByTimeAsync(5000); });

                expect(calmServiceMock.fetchDecoratorsForTarget).toHaveBeenCalledTimes(2);
                expect(screen.getByRole('article', { name: 'deployment decorator dep-1' })).toBeInTheDocument();
                expect(screen.queryByText(/^Could not load decorators\./)).not.toBeInTheDocument();
            } finally {
                error.mockRestore();
                vi.useRealTimers();
            }
        });

        it('reports an empty list for a pattern', async () => {
            const onDecoratorsChange = vi.fn();
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} onDecoratorsChange={onDecoratorsChange} />
                </MemoryRouter>
            );

            await waitFor(() => expect(onDecoratorsChange).toHaveBeenCalledWith([]));
            expect(calmServiceMock.fetchDecoratorsForTarget).not.toHaveBeenCalled();
        });
    });

    describe('unknown tab', () => {
        it('falls back to the diagram for an unknown tab value', () => {
            render(
                <MemoryRouter initialEntries={['/?tab=no-such-tab']}>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: 'Diagram' }).className).toContain('tab-active');
        });

        it('falls back to the diagram for a tab the resource does not have', () => {
            render(
                <MemoryRouter initialEntries={['/?tab=deployments']}>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            expect(screen.getByTestId('drawer')).toBeInTheDocument();
        });

        it('drops an unknown tab from the URL, and keeps the other parameters', async () => {
            function SearchProbe() {
                return <div data-testid="search">{useLocation().search}</div>;
            }
            render(
                <MemoryRouter initialEntries={['/?tab=no-such-tab&type=deployment']}>
                    <DiagramSection data={architectureData} />
                    <SearchProbe />
                </MemoryRouter>
            );

            await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?type=deployment'));
        });

        it('keeps a known tab that is hidden for now in the URL', () => {
            function SearchProbe() {
                return <div data-testid="search">{useLocation().search}</div>;
            }
            render(
                <MemoryRouter initialEntries={['/?tab=decorators']}>
                    <DiagramSection data={patternData} />
                    <SearchProbe />
                </MemoryRouter>
            );

            expect(screen.getByTestId('search').textContent).toBe('?tab=decorators');
        });
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

        it('fetches the decorators of every type with namespace, id and version', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await screen.findByTestId('drawer');

            await waitFor(() => expect(calmServiceMock.fetchDecoratorsForTarget).toHaveBeenCalledWith('arch-namespace', DECORATOR_TARGET));
            expect(calmServiceMock.resolveArchitectureVersionTarget).toHaveBeenCalledWith('arch-namespace', 'test-arch', '1.0.0');
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
            expect(screen.getByRole('tab', { name: 'Decorators' })).toBeInTheDocument();
            expect(screen.queryByRole('tab', { name: /deployments/i })).not.toBeInTheDocument();
        });

        it('paints the active view tab with the redesign brand blue, not the old accent (#8)', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            // Default active tab is Diagram — the one blue active system is the
            // interaction token (--color-interaction → #2563EB), so the filled pill
            // must carry the token-backed brand-blue class (not bg-accent).
            const activeTab = screen.getByRole('tab', { name: /diagram/i });
            expect(activeTab).toHaveClass('!bg-[var(--color-interaction)]');
            expect(activeTab.className).not.toContain('bg-accent');
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

            expect(navigate).toHaveBeenCalledWith('/arch-namespace/architectures/test-arch/2.0.0', expect.objectContaining({ state: { timelineSelection: true } }));
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

    describe('explicit timeline current-moment redirect', () => {
        const momentFor = (key: string, version: string, validFrom: string) => ({
            'unique-id': key,
            'node-type': 'moment',
            name: key,
            'valid-from': validFrom,
            details: {
                'detailed-architecture': `/calm/namespaces/arch-namespace/architectures/test-arch/versions/${version}`,
            },
        });
        const latestArchitectureData = { ...architectureData, version: '2.0.0' };
        const crumb: BreadcrumbItem = { namespace: 'finos', type: 'patterns', id: 'api-gateway-pattern', version: '1.0.0' };

        beforeEach(() => {
            calmServiceMock.fetchArchitectureTimeline.mockResolvedValue({
                'current-moment': 'before',
                moments: [momentFor('before', '1.0.0', '2024-01-01'), momentFor('after', '2.0.0', '2025-01-01')],
            });
        });

        const renderAt = (data: Data & { calmType: 'Architectures' }, state: unknown) =>
            render(
                <MemoryRouter initialEntries={[{ pathname: '/', state }]}>
                    <DiagramSection data={data} breadcrumbs={[crumb]} />
                </MemoryRouter>
            );

        it('redirects a landing on the latest version to the current moment once', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);

            renderAt(latestArchitectureData, null);

            await waitFor(() => {
                expect(navigate).toHaveBeenCalledWith('/arch-namespace/architectures/test-arch/1.0.0', {
                    replace: true,
                    state: null,
                });
            });
            expect(navigate).toHaveBeenCalledTimes(1);
        });

        it('marks a timeline selection in navigation state and keeps the existing state', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);
            const user = userEvent.setup();

            renderAt(architectureData, { breadcrumbs: [crumb] });
            await user.click(screen.getByText('nav-2.0.0'));

            expect(navigate).toHaveBeenCalledWith('/arch-namespace/architectures/test-arch/2.0.0', {
                state: { breadcrumbs: [crumb], timelineSelection: true },
            });
        });

        it('stays on the latest version when the timeline selected it', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);

            // The instance that mounts after a timeline selection (Hub remounts
            // DiagramSection on every version change).
            renderAt(latestArchitectureData, { breadcrumbs: [crumb], timelineSelection: true });

            await waitFor(() => {
                expect(screen.getByTestId('timeline-bar')).toHaveAttribute('data-moments', '2');
            });
            expect(navigate).not.toHaveBeenCalled();
        });

        it('does not carry the timeline flag into breadcrumb navigation', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);
            const user = userEvent.setup();

            renderAt(latestArchitectureData, { breadcrumbs: [crumb], timelineSelection: true });
            await user.click(screen.getByRole('button', { name: 'api-gateway-pattern' }));

            expect(navigate).toHaveBeenCalledWith('/finos/patterns/api-gateway-pattern/1.0.0', {
                state: { breadcrumbs: [] },
            });
        });
    });

    // Shared: force useIsMobile() to report a mobile viewport. Returns a restore fn.
    function mockMobileViewport() {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: query.includes('max-width: 1023px'),
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        })) as unknown as typeof window.matchMedia;
        return () => {
            window.matchMedia = original;
        };
    }

    describe('mobile view pill (#11)', () => {

        it('renders a labelled "View" pill (not a bare icon) as the menu trigger on mobile', () => {
            const restore = mockMobileViewport();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const trigger = screen.getByRole('button', { name: /view options/i });
            // The trigger now carries a visible "View" label, replacing the bare eye.
            expect(trigger).toHaveTextContent('View');
            restore();
        });

        it('opens the full-screen view menu when the pill is clicked', async () => {
            const restore = mockMobileViewport();
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('button', { name: /view options/i }));
            // Opening reveals the view-mode list (Diagram / JSON / Decorators rows).
            expect(screen.getByRole('button', { name: /close view options/i })).toBeInTheDocument();
            restore();
        });

        // Desktop boundary guard: the pill is gated by render-path (the desktop
        // return ships `tabs`, never `viewMenu`), not by an `isMobile` conditional
        // in the JSX. Locking it here means a future refactor that hoists `viewMenu`
        // into the desktop return regresses with a red test, not green ones. No
        // matchMedia mock — the default reports desktop.
        it('shows the view-mode tabs and NOT the "View" pill on desktop', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            // Desktop ships the inline view-mode tabs...
            expect(screen.getByRole('tab', { name: /diagram/i })).toBeInTheDocument();
            expect(screen.getByRole('tab', { name: /json/i })).toBeInTheDocument();
            // ...and never the mobile "View options" pill (a button, distinct from
            // the role="tab" view-mode buttons).
            expect(screen.queryByRole('button', { name: /view options/i })).not.toBeInTheDocument();
            expect(screen.queryByText('View')).not.toBeInTheDocument();
        });
    });

    describe('breadcrumb navigation', () => {
        it('renders parent breadcrumb in the heading when breadcrumbs prop is provided', () => {
            const crumbs: BreadcrumbItem[] = [
                { namespace: 'finos', type: 'patterns', id: 'api-gateway-pattern', version: '1.0.0' },
            ];

            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} breadcrumbs={crumbs} />
                </MemoryRouter>
            );

            const heading = screen.getByRole('heading');
            expect(heading).toHaveTextContent('api-gateway-pattern');
        });

        it('navigates to parent when breadcrumb is clicked', async () => {
            const navigate = vi.fn();
            vi.mocked(useNavigate).mockReturnValue(navigate);
            const user = userEvent.setup();
            const crumbs: BreadcrumbItem[] = [
                { namespace: 'finos', type: 'patterns', id: 'api-gateway-pattern', version: '1.0.0' },
            ];

            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} breadcrumbs={crumbs} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('button', { name: 'api-gateway-pattern' }));

            expect(navigate).toHaveBeenCalledWith(
                '/finos/patterns/api-gateway-pattern/1.0.0',
                { state: { breadcrumbs: [] } }
            );
        });
    });

    describe('mobile breadcrumb back bar', () => {
        const crumbs: BreadcrumbItem[] = [
            { namespace: 'finos', type: 'architectures', id: 'root-arch', version: '1.0.0' },
            { namespace: 'finos', type: 'architectures', id: 'parent-arch', version: '2.0.0', name: 'Parent Arch' },
        ];

        it('renders a back chip to the immediate parent on mobile', () => {
            const restore = mockMobileViewport();
            try {
                render(
                    <MemoryRouter>
                        <DiagramSection data={architectureData} breadcrumbs={crumbs} />
                    </MemoryRouter>
                );

                expect(screen.getByRole('button', { name: /back to Parent Arch/i })).toBeInTheDocument();
            } finally {
                restore();
            }
        });

        it('navigates to the parent with the trail sliced when tapped', async () => {
            const restore = mockMobileViewport();
            try {
                const navigate = vi.fn();
                vi.mocked(useNavigate).mockReturnValue(navigate);
                const user = userEvent.setup();
                render(
                    <MemoryRouter>
                        <DiagramSection data={architectureData} breadcrumbs={crumbs} />
                    </MemoryRouter>
                );

                await user.click(screen.getByRole('button', { name: /back to Parent Arch/i }));

                expect(navigate).toHaveBeenCalledWith('/finos/architectures/parent-arch/2.0.0', {
                    state: { breadcrumbs: [crumbs[0]] },
                });
            } finally {
                restore();
            }
        });

        it('falls back to the parent id when the crumb has no display name', () => {
            const restore = mockMobileViewport();
            try {
                render(
                    <MemoryRouter>
                        <DiagramSection data={architectureData} breadcrumbs={[crumbs[0]]} />
                    </MemoryRouter>
                );

                expect(screen.getByRole('button', { name: /back to root-arch/i })).toBeInTheDocument();
            } finally {
                restore();
            }
        });

        it('does not render the chip without a trail (canvas stays full-bleed)', () => {
            const restore = mockMobileViewport();
            try {
                render(
                    <MemoryRouter>
                        <DiagramSection data={architectureData} />
                    </MemoryRouter>
                );

                expect(screen.queryByRole('button', { name: /back to/i })).not.toBeInTheDocument();
            } finally {
                restore();
            }
        });

        // Desktop boundary guard: the chip lives only in the mobile return; desktop
        // shows the header trail instead. No matchMedia mock — default is desktop.
        it('does not render the chip on desktop even with a trail', () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} breadcrumbs={crumbs} />
                </MemoryRouter>
            );

            expect(screen.queryByRole('button', { name: /back to/i })).not.toBeInTheDocument();
            // The trail itself renders in the header instead.
            expect(screen.getByRole('button', { name: 'Parent Arch' })).toBeInTheDocument();
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

    describe('save/reset default layout', () => {
        it('hides "Save as default layout" without a write grant', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await screen.findByTestId('drawer');
            // Give the slug→numeric resolution (fetchMappings) a tick to settle.
            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());

            expect(screen.queryByLabelText('Save as default layout')).not.toBeInTheDocument();
        });

        it('shows "Save as default layout" once a write grant resolves', async () => {
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await waitFor(() => expect(screen.getByLabelText('Save as default layout')).toBeInTheDocument());
            expect(userAccessMock.canWriteNamespace).toHaveBeenCalledWith('arch-namespace');
        });

        it('shows "Save as default layout" for a pattern once a write grant resolves', async () => {
            // Numeric id, so this doesn't depend on fetchMappings resolving a slug match —
            // that path is already covered by the architecture slug tests below.
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            render(
                <MemoryRouter>
                    <DiagramSection data={{ ...patternData, id: '99' }} />
                </MemoryRouter>
            );

            await waitFor(() => expect(screen.getByLabelText('Save as default layout')).toBeInTheDocument());
            expect(userAccessMock.canWriteNamespace).toHaveBeenCalledWith('pattern-namespace');
        });

        it('shows "Reset to default layout" for patterns regardless of write access, disabled with no scratch layout', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            const resetButton = await screen.findByLabelText('Reset to default layout');
            expect(resetButton).toBeDisabled();
        });

        it('shows "Save as default layout" for a pattern on mobile too', async () => {
            // The mobile view-options menu used to hand-copy the desktop gating condition
            // instead of reusing showLayoutActions — exactly the kind of drift that would
            // leave patterns supported on desktop but not mobile.
            const restore = mockMobileViewport();
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={{ ...patternData, id: '99' }} />
                </MemoryRouter>
            );

            await user.click(screen.getByRole('button', { name: /view options/i }));
            expect(await screen.findByLabelText('Save as default layout')).toBeInTheDocument();
            expect(screen.getByLabelText('Reset to default layout')).toBeInTheDocument();
            restore();
        });

        it('shows "Reset to default layout" for architectures regardless of write access, disabled with no scratch layout', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            const resetButton = await screen.findByLabelText('Reset to default layout');
            expect(resetButton).toBeDisabled();
        });

        it('enables "Reset to default layout" after a drag writes a scratch layout, even though the viewportKey/epoch did not change', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            // Let the slug -> numeric id resolution settle so viewportKey is set
            // ('arch-namespace/Architectures/42', per fetchMappings above).
            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());
            const resetButton = await screen.findByLabelText('Reset to default layout');
            expect(resetButton).toBeDisabled();

            // Mirror what useGraphInteractions does on drag-end: write to
            // localStorage first, then report the positions upward via
            // onPositionsChange (a ref-only write in DiagramSection prior to the
            // fix -- no re-render, so the button stayed stuck disabled).
            saveNodePositions('arch-namespace/Architectures/42', [{ id: 'node-1', position: { x: 1, y: 2 }, data: {} }] as Node[]);
            const user = userEvent.setup();
            await user.click(screen.getByText('simulate-drag-report'));

            await waitFor(() => expect(resetButton).toBeEnabled());
        });

        it('disables "Reset to default layout" again once reset is clicked', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());
            const resetButton = await screen.findByLabelText('Reset to default layout');

            saveNodePositions('arch-namespace/Architectures/42', [{ id: 'node-1', position: { x: 1, y: 2 }, data: {} }] as Node[]);
            const user = userEvent.setup();
            await user.click(screen.getByText('simulate-drag-report'));
            await waitFor(() => expect(resetButton).toBeEnabled());

            await user.click(resetButton);
            await waitFor(() => expect(resetButton).toBeDisabled());
        });

        it('surfaces a save failure as an inline alert in the main pane on desktop', async () => {
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            layoutServiceMock.saveDefaultLayout.mockRejectedValueOnce(new Error('boom'));
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());
            await user.click(screen.getByText('simulate-drag-report'));
            const saveButton = await screen.findByLabelText('Save as default layout');

            await user.click(saveButton);

            expect(await screen.findByRole('alert')).toHaveTextContent('boom');
            // The old wrapper-title tooltip is gone — both buttons' own titles
            // used to make it unreachable by hover, so it never worked.
            expect(saveButton.parentElement).not.toHaveAttribute('title');
        });

        it('does not render an alert after a successful save', async () => {
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());
            await user.click(screen.getByText('simulate-drag-report'));
            await user.click(await screen.findByLabelText('Save as default layout'));

            await waitFor(() => expect(layoutServiceMock.saveDefaultLayout).toHaveBeenCalled());
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('surfaces a save failure as an inline alert on mobile even after the menu closes', async () => {
            const restore = mockMobileViewport();
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            layoutServiceMock.saveDefaultLayout.mockRejectedValueOnce(new Error('boom'));
            const user = userEvent.setup();
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());
            await user.click(screen.getByText('simulate-drag-report'));

            await user.click(screen.getByRole('button', { name: /view options/i }));
            const saveButton = await screen.findByLabelText('Save as default layout');
            await user.click(saveButton);

            // The mobile handler closes the overlay before the async save settles —
            // the alert must still surface once it does, in the main pane underneath.
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
            expect(await screen.findByRole('alert')).toHaveTextContent('boom');
            restore();
        });
    });
});
