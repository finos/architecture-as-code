import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { NamespacePage } from './NamespacePage.js';
import { resolveResourceDetailPath } from '../tree-navigation/navigation-loaders.js';
import { NamespaceCounts } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () {
        return {
            fetchArchitectureSummaries: vi
                .fn()
                .mockResolvedValue([{ id: 1, name: 'Arch One', description: 'An arch', customId: 'arch-one' }]),
            fetchPatternSummaries: vi.fn().mockResolvedValue([]),
            fetchFlowSummaries: vi.fn().mockResolvedValue([]),
            fetchStandardSummaries: vi.fn().mockResolvedValue([]),
        };
    }),
}));

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () {
        return {
            fetchInterfacesForNamespace: vi
                .fn()
                .mockResolvedValue([{ id: 7, name: 'My Interface', description: '' }]),
        };
    }),
}));

vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(function () {
        return { fetchAdrSummaries: vi.fn().mockResolvedValue([]) };
    }),
}));

// Stub version resolution so item clicks navigate deterministically.
vi.mock('../tree-navigation/navigation-loaders.js', async () => {
    const actual = await vi.importActual<typeof import('../tree-navigation/navigation-loaders.js')>(
        '../tree-navigation/navigation-loaders.js'
    );
    return { ...actual, resolveResourceDetailPath: vi.fn() };
});

const counts: NamespaceCounts = {
    namespace: 'traderx',
    architectures: 1,
    patterns: 0,
    flows: 0,
    standards: 0,
    adrs: 0,
    interfaces: 1,
    total: 2,
};

const renderPage = (initialEntries: string[] = ['/namespace/traderx'], c: NamespaceCounts = counts) =>
    render(
        <MemoryRouter initialEntries={initialEntries}>
            <NamespacePage namespace="traderx" counts={c} />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(vi.fn());
    (resolveResourceDetailPath as Mock).mockResolvedValue('/traderx/architectures/arch-one/1.0.0');
});

describe('NamespacePage', () => {
    it('renders the breadcrumb and header total from counts', async () => {
        renderPage();
        expect(screen.getByText('Explore')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'traderx' })).toBeInTheDocument();
        expect(screen.getByText('2 artefacts')).toBeInTheDocument();
        await screen.findByText('Arch One');
    });

    it('renders all six type tabs with their counts (zero-count tabs included)', () => {
        renderPage();
        // Zero-count tabs are present, not hidden.
        expect(screen.getByTestId('type-tab-Architectures')).toHaveTextContent('Architectures');
        expect(screen.getByTestId('type-tab-Patterns')).toBeInTheDocument();
        expect(screen.getByTestId('type-tab-Flows')).toBeInTheDocument();
        expect(screen.getByTestId('type-tab-Standards')).toBeInTheDocument();
        expect(screen.getByTestId('type-tab-ADRs')).toBeInTheDocument();
        expect(screen.getByTestId('type-tab-Interfaces')).toBeInTheDocument();
    });

    it('defaults the active tab to the first type with items', async () => {
        renderPage();
        expect(screen.getByTestId('type-tab-Architectures')).toHaveAttribute('aria-selected', 'true');
        // Architecture items show in the grid.
        expect(await screen.findByText('Arch One')).toBeInTheDocument();
    });

    it('honours the ?type= query param as the active tab', async () => {
        renderPage(['/namespace/traderx?type=interfaces']);
        expect(screen.getByTestId('type-tab-Interfaces')).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByText('My Interface')).toBeInTheDocument();
        // The default (architectures) is not active and its item is not shown.
        expect(screen.queryByText('Arch One')).not.toBeInTheDocument();
    });

    it('falls back to the default when ?type= is invalid', async () => {
        renderPage(['/namespace/traderx?type=bogus']);
        expect(screen.getByTestId('type-tab-Architectures')).toHaveAttribute('aria-selected', 'true');
        await screen.findByText('Arch One');
    });

    it('switches the active type when a tab is clicked', async () => {
        renderPage();
        await screen.findByText('Arch One');
        fireEvent.click(screen.getByTestId('type-tab-Interfaces'));
        expect(screen.getByTestId('type-tab-Interfaces')).toHaveAttribute('aria-selected', 'true');
        expect(await screen.findByText('My Interface')).toBeInTheDocument();
    });

    it('shows an empty state for a zero-item active type', async () => {
        renderPage(['/namespace/traderx?type=patterns']);
        expect(await screen.findByTestId('empty-state')).toHaveTextContent(
            'No patterns in this namespace yet'
        );
    });

    it('uses the acronym-aware plural for the ADRs empty state', async () => {
        renderPage(['/namespace/traderx?type=adrs']);
        // Acronym preserved: "ADRs", not the naive lowercase "adrs".
        expect(await screen.findByTestId('empty-state')).toHaveTextContent(
            'No ADRs in this namespace yet'
        );
    });

    it('navigates to the item detail route when a card is clicked', async () => {
        const navigate = vi.fn();
        (useNavigate as Mock).mockReturnValue(navigate);
        renderPage();

        fireEvent.click(await screen.findByText('Arch One'));

        await waitFor(() => {
            expect(resolveResourceDetailPath).toHaveBeenCalledWith(
                'arch-one',
                'Architectures',
                'traderx',
                expect.anything(),
                expect.anything()
            );
            expect(navigate).toHaveBeenCalledWith('/traderx/architectures/arch-one/1.0.0');
        });
    });

    it('wires the tabpanel to the active tab (aria-controls / aria-labelledby)', async () => {
        renderPage();
        const panel = screen.getByRole('tabpanel');
        const activeTab = screen.getByTestId('type-tab-Architectures');
        // The active tab controls the panel; the panel is labelled by that tab.
        expect(activeTab).toHaveAttribute('aria-controls', panel.id);
        expect(panel).toHaveAttribute('aria-labelledby', activeTab.id);
        await screen.findByText('Arch One');
    });

    it('defaults to the first non-empty type when architectures is zero', async () => {
        // Architectures = 0 but interfaces non-zero: the default must land on the
        // first non-empty type (Interfaces), not the empty Architectures tab.
        const c: NamespaceCounts = {
            namespace: 'traderx',
            architectures: 0,
            patterns: 0,
            flows: 0,
            standards: 0,
            adrs: 0,
            interfaces: 1,
            total: 1,
        };
        renderPage(['/namespace/traderx'], c);
        expect(screen.getByTestId('type-tab-Interfaces')).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByTestId('type-tab-Architectures')).toHaveAttribute('aria-selected', 'false');
        expect(await screen.findByText('My Interface')).toBeInTheDocument();
    });

    describe('while counts are loading (counts undefined)', () => {
        const renderLoading = (initialEntries: string[] = ['/namespace/traderx']) =>
            render(
                <MemoryRouter initialEntries={initialEntries}>
                    <NamespacePage namespace="traderx" counts={undefined} />
                </MemoryRouter>
            );

        it('renders all tabs resting (not dimmed) and shows a spinner, not a grid', () => {
            const { container } = renderLoading();
            // No tab is dimmed: an arbitrary tab still reads as resting body text.
            expect(screen.getByTestId('type-tab-Patterns')).toHaveStyle({
                color: colors.redesign.bodyAlt,
            });
            // Grid is gated until counts resolve — spinner, no cards, no empty state.
            expect(container.querySelector('.loading-spinner')).toBeInTheDocument();
            expect(screen.queryByTestId('item-card')).not.toBeInTheDocument();
            expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument();
        });

        it('holds Architectures active without jumping while loading', () => {
            renderLoading();
            // No counts yet → no first-non-empty default committed; Architectures held.
            expect(screen.getByTestId('type-tab-Architectures')).toHaveAttribute(
                'aria-selected',
                'true'
            );
        });

        it('omits the header artefact count rather than flashing "0 artefacts"', () => {
            renderLoading();
            // The header meta is suppressed until counts resolve — no premature zero.
            expect(screen.queryByText(/artefact/i)).not.toBeInTheDocument();
        });
    });
});
