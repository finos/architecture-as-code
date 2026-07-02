import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { NamespacePage } from './NamespacePage.js';
import { useNavigate } from 'react-router-dom';
import { resolveResourceDetailPath } from '../tree-navigation/navigation-loaders.js';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: vi.fn() };
});

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return ({
        fetchArchitectureSummaries: vi.fn().mockResolvedValue([{ id: 1, name: 'Arch One' }]),
        fetchPatternSummaries: vi.fn().mockResolvedValue([]),
        fetchFlowSummaries: vi.fn().mockResolvedValue([]),
        fetchStandardSummaries: vi.fn().mockResolvedValue([]),
    }); }),
}));

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () { return ({
        fetchInterfacesForNamespace: vi.fn().mockResolvedValue([{ id: 7, name: 'My Interface', description: '' }]),
    }); }),
}));

vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(function () { return ({
        fetchAdrSummaries: vi.fn().mockResolvedValue([]),
    }); }),
}));

// Stub version resolution so item clicks navigate deterministically.
vi.mock('../tree-navigation/navigation-loaders.js', async () => {
    const actual = await vi.importActual<typeof import('../tree-navigation/navigation-loaders.js')>(
        '../tree-navigation/navigation-loaders.js'
    );
    return { ...actual, resolveResourceDetailPath: vi.fn() };
});

const renderPage = (total = 2) =>
    render(
        <MemoryRouter>
            <NamespacePage namespace="traderx" total={total} />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(vi.fn());
    (resolveResourceDetailPath as Mock).mockResolvedValue('/traderx/architectures/1/1.0.0');
});

describe('NamespacePage', () => {
    it('renders the breadcrumb and namespace header with the artefact total', async () => {
        renderPage(9);
        expect(screen.getByText('Explore')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'traderx' })).toBeInTheDocument();
        expect(screen.getByText('9 artefacts')).toBeInTheDocument();
        await screen.findByText('Arch One');
    });

    it('uses the singular artefact label when total is 1', async () => {
        renderPage(1);
        expect(screen.getByText('1 artefact')).toBeInTheDocument();
        await screen.findByText('Arch One');
    });

    it('lists items grouped by resource type', async () => {
        renderPage();
        expect(await screen.findByText('Arch One')).toBeInTheDocument();
        expect(screen.getByText('My Interface')).toBeInTheDocument();
        // Only the non-empty type groups render headings.
        expect(screen.getByText('Architectures')).toBeInTheDocument();
        expect(screen.getByText('Interfaces')).toBeInTheDocument();
        expect(screen.queryByText('Patterns')).not.toBeInTheDocument();
    });

    it('navigates to the item detail route when an item is clicked', async () => {
        const navigate = vi.fn();
        (useNavigate as Mock).mockReturnValue(navigate);
        renderPage();

        fireEvent.click(await screen.findByText('Arch One'));

        await waitFor(() => {
            expect(resolveResourceDetailPath).toHaveBeenCalledWith(
                '1',
                'Architectures',
                'traderx',
                expect.anything(),
                expect.anything()
            );
            expect(navigate).toHaveBeenCalledWith('/traderx/architectures/1/1.0.0');
        });
    });
});
