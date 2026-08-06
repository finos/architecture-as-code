import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { DiagramSection } from './DiagramSection.js';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { BreadcrumbItem, Data } from '../../../model/calm.js';
import { saveNodePositions } from '../../../visualizer/services/node-position-service.js';
import type { Node } from 'reactflow';

const calmServiceMock = {
    fetchDeploymentDecoratorsForArchitecture: vi.fn().mockResolvedValue([]),
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
        onPositionsChange,
    }: {
        data: Data;
        onPositionsChange?: (positions: { id: string; position: { x: number; y: number } }[]) => void;
    }) => (
        <div data-testid="drawer">
            Drawer for {data.id}
            <button
                onClick={() => onPositionsChange?.([{ id: 'node-1', position: { x: 1, y: 2 } }])}
            >
                simulate-drag-report
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
    CalmService: vi.fn().mockImplementation(function () { return {
        fetchDeploymentDecoratorsForArchitecture: calmServiceMock.fetchDeploymentDecoratorsForArchitecture,
        fetchVersionsByCustomId: calmServiceMock.fetchVersionsByCustomId,
        fetchArchitectureTimeline: calmServiceMock.fetchArchitectureTimeline,
        fetchArchitectureSummaries: calmServiceMock.fetchArchitectureSummaries,
        fetchPatternSummaries: calmServiceMock.fetchPatternSummaries,
        fetchMappings: calmServiceMock.fetchMappings,
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
        calmServiceMock.fetchDeploymentDecoratorsForArchitecture.mockResolvedValue([]);
        calmServiceMock.fetchVersionsByCustomId.mockResolvedValue(['1.0.0', '2.0.0']);
        calmServiceMock.fetchArchitectureTimeline.mockRejectedValue(new Error('no timeline'));
        userAccessMock.canWriteNamespace.mockReturnValue(false);
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

        it('fetches deployment decorators via the shared service method with namespace, id and version', async () => {
            render(
                <MemoryRouter>
                    <DiagramSection data={architectureData} />
                </MemoryRouter>
            );

            await screen.findByTestId('drawer');

            expect(calmServiceMock.fetchDeploymentDecoratorsForArchitecture).toHaveBeenCalledWith(
                'arch-namespace',
                'test-arch',
                '1.0.0'
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

            expect(navigate).toHaveBeenCalledWith('/arch-namespace/architectures/test-arch/2.0.0', expect.objectContaining({ state: null }));
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
            // Opening reveals the view-mode list (Diagram / JSON / Deployments rows).
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

        it('never shows layout actions for patterns, even with a write grant', async () => {
            userAccessMock.canWriteNamespace.mockReturnValue(true);
            render(
                <MemoryRouter>
                    <DiagramSection data={patternData} />
                </MemoryRouter>
            );

            await screen.findByTestId('drawer');
            expect(screen.queryByLabelText('Save as default layout')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Reset to default layout')).not.toBeInTheDocument();
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
            // ('arch-namespace/42', per fetchMappings above).
            await waitFor(() => expect(calmServiceMock.fetchMappings).toHaveBeenCalled());
            const resetButton = await screen.findByLabelText('Reset to default layout');
            expect(resetButton).toBeDisabled();

            // Mirror what useGraphInteractions does on drag-end: write to
            // localStorage first, then report the positions upward via
            // onPositionsChange (a ref-only write in DiagramSection prior to the
            // fix -- no re-render, so the button stayed stuck disabled).
            saveNodePositions('arch-namespace/42', [{ id: 'node-1', position: { x: 1, y: 2 }, data: {} }] as Node[]);
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

            saveNodePositions('arch-namespace/42', [{ id: 'node-1', position: { x: 1, y: 2 }, data: {} }] as Node[]);
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
