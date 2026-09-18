import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExploreRail } from './ExploreRail.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';

// Counts are owned by Hub and passed in as props; the rail no longer fetches them.
const namespaceCounts = [
    { namespace: 'finos', total: 4 },
    { namespace: 'traderx', total: 9 },
] as NamespaceCounts[];
const domainCounts: DomainControlCount[] = [
    { domain: 'security', controlCount: 7 },
    { domain: 'compliance', controlCount: 0 },
];

interface RenderRailOptions {
    onCollapse?: () => void;
    namespacesLoading?: boolean;
    domainsLoading?: boolean;
    namespacesFailed?: boolean;
    domainsFailed?: boolean;
    namespaceCounts?: NamespaceCounts[];
    storage?: Storage;
}

const renderRail = (path = '/', opts: RenderRailOptions = {}) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                {['/', '/namespace/:ns', '/domain/:domain'].map((p) => (
                    <Route
                        key={p}
                        path={p}
                        element={
                            <ExploreRail
                                namespaceCounts={opts.namespaceCounts ?? namespaceCounts}
                                domainCounts={domainCounts}
                                namespacesLoading={opts.namespacesLoading}
                                domainsLoading={opts.domainsLoading}
                                namespacesFailed={opts.namespacesFailed}
                                domainsFailed={opts.domainsFailed}
                                onCollapse={opts.onCollapse}
                                storage={opts.storage}
                            />
                        }
                    />
                ))}
            </Routes>
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ExploreRail', () => {
    it('renders the Explore header and the two section labels', async () => {
        renderRail();
        expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
        expect(screen.getByText('NAMESPACES')).toBeInTheDocument();
        expect(screen.getByText('CONTROL DOMAINS')).toBeInTheDocument();
        // Wait for async data so the act warning does not leak into later tests.
        await screen.findByRole('link', { name: /finos/ });
    });

    it('renders namespace rows with totals and domain rows with control counts', async () => {
        renderRail();
        const finos = await screen.findByRole('link', { name: /finos/ });
        expect(finos).toHaveAttribute('href', '/namespace/finos');
        expect(await screen.findByRole('link', { name: /security/ })).toHaveAttribute('href', '/domain/security');

        const badges = screen.getAllByTestId('count-badge').map((b) => b.textContent);
        expect(badges).toEqual(expect.arrayContaining(['4', '9', '7', '0']));
    });

    it('client-filters namespace rows by the filter input', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });

        fireEvent.change(screen.getByLabelText('Filter namespaces'), { target: { value: 'trade' } });

        expect(screen.getByRole('link', { name: /traderx/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /finos/ })).not.toBeInTheDocument();
        // Domain rows are unaffected by the namespace filter.
        expect(screen.getByRole('link', { name: /security/ })).toBeInTheDocument();
    });

    it('tells a filter matching nothing apart from a genuinely empty namespace list', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });

        fireEvent.change(screen.getByLabelText('Filter namespaces'), { target: { value: 'no-such-namespace' } });
        expect(screen.getByText('No namespaces match your filter')).toBeInTheDocument();
    });

    it('marks the namespace row matching the URL as active', async () => {
        renderRail('/namespace/traderx');
        const active = await screen.findByRole('link', { name: /traderx/ });
        expect(active).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: /finos/ })).not.toHaveAttribute('aria-current');
    });

    it('marks the domain row matching the URL as active', async () => {
        renderRail('/domain/security');
        const active = await screen.findByRole('link', { name: /security/ });
        expect(active).toHaveAttribute('aria-current', 'page');
    });

    it('invokes onCollapse when the collapse button is clicked', async () => {
        const onCollapse = vi.fn();
        renderRail('/', { onCollapse });
        fireEvent.click(screen.getByLabelText('Collapse sidebar'));
        expect(onCollapse).toHaveBeenCalled();
        await screen.findByRole('link', { name: /finos/ });
    });

    it('shows a spinner in both sections while both are loading', () => {
        renderRail('/', { namespacesLoading: true, domainsLoading: true });
        expect(screen.getAllByRole('status')).toHaveLength(2);
        expect(screen.queryByRole('link', { name: /finos/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /security/ })).not.toBeInTheDocument();
    });

    it('resolves the namespaces section independently of a still-loading domains section', async () => {
        renderRail('/', { namespacesLoading: false, domainsLoading: true });
        expect(await screen.findByRole('link', { name: /finos/ })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Loading control domains' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /security/ })).not.toBeInTheDocument();
    });

    it('resolves the domains section independently of a still-loading namespaces section', async () => {
        renderRail('/', { namespacesLoading: true, domainsLoading: false });
        expect(await screen.findByRole('link', { name: /security/ })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Loading namespaces' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /finos/ })).not.toBeInTheDocument();
    });

    it('shows items instead of spinners once both sections finish loading', async () => {
        renderRail('/', { namespacesLoading: false, domainsLoading: false });
        expect(await screen.findByRole('link', { name: /finos/ })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /security/ })).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows a distinct message when a counts fetch fails, rather than an ambiguous empty state', async () => {
        renderRail('/', { namespacesLoading: false, domainsLoading: false, namespacesFailed: true, domainsFailed: true });
        // A failed fetch is "unknown", not "confirmed zero" — the empty-state text
        // must say so rather than looking identical to a genuinely empty namespace.
        expect(await screen.findByText("Couldn't load namespaces")).toBeInTheDocument();
        expect(screen.getByText("Couldn't load control domains")).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /finos/ })).not.toBeInTheDocument();
    });
});

describe('ExploreRail — namespace hierarchy', () => {
    // finos has two children (calm, wave) and its own total; traderx is an unrelated flat root.
    const nestedNamespaceCounts = [
        { namespace: 'finos', total: 10 },
        { namespace: 'finos.calm', total: 5 },
        { namespace: 'finos.wave', total: 3 },
        { namespace: 'traderx', total: 9 },
    ] as NamespaceCounts[];

    it('collapsing finos hides its children, shows the +8 ghost count, and leaves traderx visible', async () => {
        const storage = createMemoryStorage();
        renderRail('/', { namespaceCounts: nestedNamespaceCounts, storage });
        await screen.findByRole('link', { name: 'finos' });
        expect(screen.getByRole('link', { name: 'finos.calm' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Collapse finos' }));

        expect(screen.queryByRole('link', { name: 'finos.calm' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'finos.wave' })).not.toBeInTheDocument();
        expect(screen.getByTestId('nested-count-badge')).toHaveTextContent('+8');
        expect(screen.getByRole('link', { name: 'traderx' })).toBeInTheDocument();
    });

    it('filtering "tra" surfaces both finos.traderx and traderx with full names and highlights', async () => {
        const deepNamespaceCounts = [
            { namespace: 'finos', total: 4 },
            { namespace: 'finos.traderx', total: 2 },
            { namespace: 'traderx', total: 9 },
        ] as NamespaceCounts[];
        renderRail('/', { namespaceCounts: deepNamespaceCounts });
        await screen.findByRole('link', { name: 'finos' });

        fireEvent.change(screen.getByLabelText('Filter namespaces'), { target: { value: 'tra' } });

        expect(screen.getByRole('link', { name: 'finos.traderx' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'traderx' })).toBeInTheDocument();
        expect(screen.getAllByText('tra', { selector: 'mark' }).length).toBeGreaterThan(0);
    });

    it('a filter surfaces a match under an explicitly collapsed ancestor, and clearing it restores the collapse', async () => {
        const storage = createMemoryStorage();
        renderRail('/', { namespaceCounts: nestedNamespaceCounts, storage });
        await screen.findByRole('link', { name: 'finos' });

        fireEvent.click(screen.getByRole('button', { name: 'Collapse finos' }));
        expect(screen.queryByRole('link', { name: 'finos.calm' })).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter namespaces'), { target: { value: 'calm' } });
        expect(screen.getByRole('link', { name: 'finos.calm' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter namespaces'), { target: { value: '' } });
        expect(screen.queryByRole('link', { name: 'finos.calm' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Expand finos' })).toBeInTheDocument();
    });

    it('deep-linking to /namespace/finos.calm shows the active row even with finos collapsed in storage', async () => {
        const storage = createMemoryStorage();
        storage.setItem('calmHub.railCollapsedNamespaces', JSON.stringify(['finos']));
        renderRail('/namespace/finos.calm', { namespaceCounts: nestedNamespaceCounts, storage });

        const active = await screen.findByRole('link', { name: 'finos.calm' });
        expect(active).toHaveAttribute('aria-current', 'page');
    });

    it('renders no chevron and no nested badge on CONTROL DOMAINS rows', async () => {
        renderRail();
        await screen.findByRole('link', { name: /security/ });
        expect(screen.queryByTestId('nested-count-badge')).not.toBeInTheDocument();
        // Domain rows never gain a disclosure chevron — only namespace rows with children do.
        expect(screen.queryByRole('button', { name: /security/ })).not.toBeInTheDocument();
    });
});
