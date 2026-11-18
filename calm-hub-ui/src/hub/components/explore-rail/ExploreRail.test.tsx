import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExploreRail } from './ExploreRail.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import type { UserAccess, UserAccessPermission } from '../../../model/user-access.js';
import type { UserAccessService } from '../../../service/user-access-service.js';
import { UserAccessProvider } from '../../../admin/context/UserAccessContext.js';
import { colors } from '../../../theme/colors.js';

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

        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'trade' } });

        expect(screen.getByRole('link', { name: /traderx/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /finos/ })).not.toBeInTheDocument();
    });

    it('tells a filter matching nothing apart from a genuinely empty namespace list', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });

        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'no-such-namespace' } });
        expect(screen.getByText('No namespaces match your filter')).toBeInTheDocument();
    });

    it('says nothing was fetched, not that the filter missed, when the namespace list is empty', () => {
        renderRail('/', { namespaceCounts: [] });

        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'anything' } });

        expect(screen.getByText('Nothing here')).toBeInTheDocument();
        expect(screen.queryByText('No namespaces match your filter')).not.toBeInTheDocument();
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

    it('adds each namespace description to its row tooltip', async () => {
        const [finos, ...rest] = nestedNamespaceCounts;
        renderRail('/', { namespaceCounts: [{ ...finos, description: 'FINOS reference architectures' }, ...rest], storage: createMemoryStorage() });
        expect(await screen.findByRole('link', { name: 'finos' })).toHaveAttribute('title', 'finos\nFINOS reference architectures');
        expect(screen.getByRole('link', { name: 'finos.calm' })).toHaveAttribute('title', 'finos.calm');
    });

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

        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'tra' } });

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

        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'calm' } });
        expect(screen.getByRole('link', { name: 'finos.calm' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: '' } });
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

describe('ExploreRail edit scope', () => {
    const abc = [
        { namespace: 'a', total: 1 },
        { namespace: 'a.b', total: 2 },
        { namespace: 'a.c', total: 3 },
    ] as NamespaceCounts[];

    function grant(namespace: string, permission: UserAccessPermission): UserAccess {
        return { userAccessId: 0, username: 'alice', permission, namespace };
    }

    const domainGrant = (domain: string, permission: UserAccessPermission): UserAccess => ({
        userAccessId: 0,
        username: 'alice',
        permission,
        domain,
    });

    const renderWithAccess = (grants: UserAccess[], storage: Storage = createMemoryStorage()) => {
        const service = { getCurrentUserAccess: () => Promise.resolve(grants) } as unknown as UserAccessService;
        return render(
            <UserAccessProvider service={service}>
                <MemoryRouter initialEntries={['/']}>
                    <ExploreRail namespaceCounts={abc} domainCounts={domainCounts} storage={storage} />
                </MemoryRouter>
            </UserAccessProvider>
        );
    };

    const chooseScope = async (label: 'All' | 'Can edit') => {
        fireEvent.click(await screen.findByRole('button', { name: 'Filter options' }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: label }));
    };
    const selectCanEdit = () => chooseScope('Can edit');
    const visiblePaths = () =>
        screen.queryAllByRole('link').map((l) => l.getAttribute('aria-label')).filter((p) => p?.startsWith('a'));
    const chip = () => screen.queryByRole('button', { name: 'Clear the Can edit filter' });

    it('hides the filter button when the user has no grants', async () => {
        renderWithAccess([]);
        await screen.findByRole('link', { name: 'a.c' });
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Filter options' })).not.toBeInTheDocument());
    });

    it('hides the filter button when there is no access provider', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });
        expect(screen.queryByRole('button', { name: 'Filter options' })).not.toBeInTheDocument();
    });

    it('hides the filter button from a global admin, who can edit everything', async () => {
        renderWithAccess([grant('GLOBAL', 'admin')]);
        await screen.findByRole('link', { name: 'a.c' });
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Filter options' })).not.toBeInTheDocument());
        expect(visiblePaths()).toEqual(['a', 'a.b', 'a.c']);
    });

    it('starts on All, with no chip and every namespace shown', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        fireEvent.click(await screen.findByRole('button', { name: 'Filter options' }));
        expect(screen.getByRole('menuitemradio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
        expect(chip()).not.toBeInTheDocument();
        expect(visiblePaths()).toEqual(['a', 'a.b', 'a.c']);
    });

    it('shows editable namespaces and their parents, and hides read-only ones', async () => {
        renderWithAccess([grant('a.c', 'write'), grant('a.b', 'read')]);
        await selectCanEdit();

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(chip()).toBeInTheDocument();
        expect(visiblePaths()).toEqual(['a', 'a.c']);
        expect(screen.getByRole('link', { name: 'a' })).toHaveStyle({ color: colors.redesign.faintAlt });
        expect(screen.getByRole('link', { name: 'a.c' })).toHaveStyle({ color: colors.redesign.bodyAlt });
    });

    it('counts an admin grant as editable', async () => {
        renderWithAccess([grant('a.b', 'admin')]);
        await selectCanEdit();
        expect(visiblePaths()).toEqual(['a', 'a.b']);
    });

    it('treats a grant on a parent as covering its children', async () => {
        renderWithAccess([grant('a', 'write')]);
        await selectCanEdit();
        expect(visiblePaths()).toEqual(['a', 'a.b', 'a.c']);
        expect(screen.getByRole('link', { name: 'a' })).toHaveStyle({ color: colors.redesign.bodyAlt });
    });

    it('combines with the text filter', async () => {
        renderWithAccess([grant('a.b', 'write'), grant('a.c', 'write')]);
        await selectCanEdit();
        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'c' } });
        expect(visiblePaths()).toEqual(['a', 'a.c']);
    });

    it('shows editable children of a collapsed parent', async () => {
        const storage = createMemoryStorage();
        storage.setItem('calmHub.railCollapsedNamespaces', JSON.stringify(['a']));
        renderWithAccess([grant('a.c', 'write')], storage);
        await selectCanEdit();
        expect(visiblePaths()).toEqual(['a', 'a.c']);
    });

    it('says so when the user cannot edit any namespace', async () => {
        renderWithAccess([grant('a', 'read')]);
        await selectCanEdit();
        expect(screen.getByText('You cannot edit any namespaces')).toBeInTheDocument();
    });

    it('returns to every namespace when the chip is cleared', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        await selectCanEdit();
        fireEvent.click(chip()!);
        expect(chip()).not.toBeInTheDocument();
        expect(visiblePaths()).toEqual(['a', 'a.b', 'a.c']);
    });

    it('returns to every namespace when All is chosen in the menu', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        await selectCanEdit();
        await chooseScope('All');
        expect(chip()).not.toBeInTheDocument();
        expect(visiblePaths()).toEqual(['a', 'a.b', 'a.c']);
    });

    it('remembers the choice in storage', async () => {
        const storage = createMemoryStorage();
        const first = renderWithAccess([grant('a.c', 'write')], storage);
        await selectCanEdit();
        first.unmount();

        renderWithAccess([grant('a.c', 'write')], storage);
        expect(await screen.findByRole('button', { name: 'Clear the Can edit filter' })).toBeInTheDocument();
        expect(visiblePaths()).toEqual(['a', 'a.c']);
    });

    it('shows only the control domains the user can edit', async () => {
        renderWithAccess([domainGrant('security', 'write'), domainGrant('compliance', 'read')]);
        await selectCanEdit();
        expect(screen.getByRole('link', { name: /security/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /compliance/ })).not.toBeInTheDocument();
    });

    it('does not count a namespace grant as access to a domain', async () => {
        renderWithAccess([grant('a', 'admin')]);
        await selectCanEdit();
        expect(screen.getByText('You cannot edit any control domains')).toBeInTheDocument();
    });
});

describe('ExploreRail text filter on control domains', () => {
    it('filters control domains as well as namespaces', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });
        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'secu' } });
        expect(screen.getByRole('link', { name: /security/ })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /compliance/ })).not.toBeInTheDocument();
    });

    it('says so when no control domain matches the filter', async () => {
        renderRail();
        await screen.findByRole('link', { name: /finos/ });
        fireEvent.change(screen.getByLabelText('Filter'), { target: { value: 'finos' } });
        expect(screen.getByText('No control domains match your filter')).toBeInTheDocument();
    });
});
