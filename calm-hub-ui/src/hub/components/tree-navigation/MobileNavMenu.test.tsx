import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { MobileNavMenu } from './MobileNavMenu.js';
import type { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { colors } from '../../../theme/colors.js';
import { createMemoryStorage } from '../../../test-support/memory-storage.js';
import { UserAccessProvider } from '../../../admin/context/UserAccessContext.js';
import { UiConfigContext } from '../../../components/ui-config/UiConfigContext.js';
import type { UserAccess } from '../../../model/user-access.js';
import type { UserAccessService } from '../../../service/user-access-service.js';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useParams: vi.fn().mockReturnValue({}),
        useNavigate: vi.fn(),
    };
});

// Stub the explorer search so it doesn't instantiate real services during these
// drill-down tests.
vi.mock('../../../components/navbar/ExplorerSearch.js', () => ({
    ExplorerSearch: () => <div data-testid="explorer-search" />,
}));

vi.mock('../../../service/calm-service.js', () => ({
    CalmService: vi.fn().mockImplementation(function () { return ({
        fetchNamespaces: vi.fn().mockResolvedValue(['finos', 'traderx']),
        fetchArchitectureSummaries: vi.fn().mockResolvedValue([{ id: 1, name: 'Arch One' }]),
        fetchPatternSummaries: vi.fn().mockResolvedValue([]),
        fetchFlowSummaries: vi.fn().mockResolvedValue([]),
        fetchStandardSummaries: vi.fn().mockResolvedValue([]),
        fetchArchitectureVersions: vi.fn().mockResolvedValue(['1.0.0']),
        fetchPatternVersions: vi.fn().mockResolvedValue([]),
        fetchFlowVersions: vi.fn().mockResolvedValue([]),
        fetchStandardVersions: vi.fn().mockResolvedValue([]),
        fetchArchitecture: vi.fn().mockResolvedValue({}),
        fetchVersionsByCustomId: vi.fn().mockResolvedValue([]),
        fetchResourceByCustomId: vi.fn().mockResolvedValue({}),
    }); }),
}));

vi.mock('../../../service/control-service.js', () => ({
    ControlService: vi.fn().mockImplementation(function () { return ({
        fetchDomains: vi.fn().mockResolvedValue(['security']),
        fetchControlsForDomain: vi.fn().mockResolvedValue([{ id: 5, name: 'Encryption', description: 'Encrypt data' }]),
    }); }),
}));

vi.mock('../../../service/interface-service.js', () => ({
    InterfaceService: vi.fn().mockImplementation(function () { return ({
        fetchInterfacesForNamespace: vi.fn().mockResolvedValue([]),
    }); }),
}));

vi.mock('../../../service/adr-service/adr-service.js', () => ({
    AdrService: vi.fn().mockImplementation(function () { return ({
        fetchAdrSummaries: vi.fn().mockResolvedValue([]),
        fetchAdrRevisions: vi.fn().mockResolvedValue([]),
        fetchAdr: vi.fn().mockResolvedValue({}),
    }); }),
}));

// Counts are owned by Hub and passed in as props; the menu no longer fetches them.
const namespaceCounts = [
    { namespace: 'finos', architectures: 4, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 4 },
    { namespace: 'traderx', architectures: 2, patterns: 0, flows: 4, standards: 0, adrs: 0, interfaces: 3, total: 9 },
] as NamespaceCounts[];
const domainCounts: DomainControlCount[] = [{ domain: 'security', controlCount: 7 }];

// A group-only node (`platform`, no namespace of its own) with one real child
// (`platform.payments`) — exercises the nested tree and the group-only case.
const nestedNamespaceCounts = [
    ...namespaceCounts,
    { namespace: 'platform.payments', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 },
] as NamespaceCounts[];

const props = {
    namespaceCounts,
    domainCounts,
    onClose: vi.fn(),
};

const renderMenu = (overrides: Partial<React.ComponentProps<typeof MobileNavMenu>> = {}) =>
    render(
        <MemoryRouter>
            <MobileNavMenu {...props} {...overrides} />
        </MemoryRouter>
    );

beforeEach(() => {
    vi.clearAllMocks();
    (useParams as Mock).mockReturnValue({});
    (useNavigate as Mock).mockReturnValue(vi.fn());
});

describe('MobileNavMenu', () => {
    it('renders the root level with Namespaces and Control Domains', () => {
        renderMenu();
        expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('Control Domains')).toBeInTheDocument();
        // No back button at the root.
        expect(screen.queryByLabelText('Back')).not.toBeInTheDocument();
    });

    it('leaves out a root row that the operator hides', () => {
        render(
            <UiConfigContext.Provider value={{ navigation: { layout: 'menu', showNamespaces: false, showControlDomains: true } }}>
                <MemoryRouter>
                    <MobileNavMenu {...props} />
                </MemoryRouter>
            </UiConfigContext.Provider>
        );

        expect(screen.queryByText('Namespaces')).not.toBeInTheDocument();
        expect(screen.getByText('Control Domains')).toBeInTheDocument();
    });

    it('drills into namespaces and shows resource types', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByText('traderx')).toBeInTheDocument();

        fireEvent.click(screen.getByText('traderx'));
        // Resource types level
        expect(await screen.findByText('Architectures')).toBeInTheDocument();
        expect(screen.getByText('Interfaces')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'traderx' })).toBeInTheDocument();
    });

    it('shows a mono count badge on each namespace row', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByText('traderx')).toBeInTheDocument();

        const badges = await screen.findAllByTestId('count-badge');
        const badgeText = badges.map((b) => b.textContent);
        expect(badgeText).toContain('4');
        expect(badgeText).toContain('9');
    });

    it('shows the namespace description under the namespace name', async () => {
        const [finos, traderx] = namespaceCounts;
        renderMenu({ namespaceCounts: [finos, { ...traderx, description: 'TraderX sample trading application.' }] });
        fireEvent.click(screen.getByText('Namespaces'));

        expect(await screen.findByText('TraderX sample trading application.')).toBeInTheDocument();
    });

    it('shows per-type count badges at the resource-type level, dimming zeros', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        fireEvent.click(await screen.findByText('traderx'));
        expect(await screen.findByText('Architectures')).toBeInTheDocument();

        // traderx: architectures 2, flows 4, interfaces 3, and three zeros.
        const badges = screen.getAllByTestId('count-badge');
        const texts = badges.map((b) => b.textContent);
        expect(texts).toEqual(['2', '0', '4', '0', '0', '3']);

        // Zero-count badges are dimmed (faint bg), matching the desktop type tabs.
        const zeroBadge = badges.find((b) => b.textContent === '0')!;
        expect(zeroBadge).toHaveStyle({ backgroundColor: colors.redesign.badgeBgFaint });
    });

    it('shows a count badge on each control-domain row', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Control Domains'));
        expect(await screen.findByText('security')).toBeInTheDocument();

        const badge = await screen.findByTestId('count-badge');
        expect(badge).toHaveTextContent('7');
    });

    it('applies the active tint to the namespace row matching the URL', async () => {
        (useParams as Mock).mockReturnValue({ ns: 'traderx' });
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));

        const activeRow = (await screen.findByText('traderx')).closest('button')!;
        expect(activeRow).toHaveStyle({ backgroundColor: colors.redesign.tintBg });
    });

    it('navigates to a resource and closes when a leaf is selected', async () => {
        const navigate = vi.fn();
        (useNavigate as Mock).mockReturnValue(navigate);
        renderMenu();

        fireEvent.click(screen.getByText('Namespaces'));
        fireEvent.click(await screen.findByText('traderx'));
        fireEvent.click(await screen.findByText('Architectures'));
        fireEvent.click(await screen.findByText('Arch One'));

        await waitFor(() => {
            expect(navigate).toHaveBeenCalledWith('/traderx/architectures/1/1.0.0');
        });
        expect(props.onClose).toHaveBeenCalled();
    });

    it('drills into control domains and lists controls', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Control Domains'));
        fireEvent.click(await screen.findByText('security'));
        expect(await screen.findByText('Encryption')).toBeInTheDocument();
    });

    it('goes back up a level with the back button', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        fireEvent.click(await screen.findByText('traderx'));
        expect(await screen.findByText('Architectures')).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back'));
        // Back to the namespaces list
        expect(await screen.findByText('traderx')).toBeInTheDocument();
        expect(screen.queryByText('Architectures')).not.toBeInTheDocument();
    });

    it('shows the static root rows immediately, even while counts are still loading', () => {
        render(
            <MemoryRouter>
                <MobileNavMenu {...props} namespacesLoading={true} domainsLoading={true} />
            </MemoryRouter>
        );
        // The root rows are static labels, not derived from counts, so they must
        // never be hidden behind a counts spinner.
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Namespaces')).toBeInTheDocument();
        expect(screen.getByText('Control Domains')).toBeInTheDocument();
    });

    it('shows a spinner only for the section whose own counts are still loading', async () => {
        render(
            <MemoryRouter>
                <MobileNavMenu {...props} namespacesLoading={false} domainsLoading={true} />
            </MemoryRouter>
        );
        // A single OR'd flag couldn't tell these two cases apart.
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByText('traderx')).toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back'));
        fireEvent.click(screen.getByText('Control Domains'));
        // Section-specific, matching ExploreRail's equivalent spinner labels —
        // not a bare "Loading" that doesn't say which section to a screen reader.
        expect(screen.getByRole('status', { name: 'Loading control domains' })).toBeInTheDocument();
        expect(screen.queryByText('security')).not.toBeInTheDocument();
    });

    it('shows a distinct message when a counts fetch fails, rather than an ambiguous empty state', async () => {
        // Hub clears counts to [] on a failed fetch, so the failure looks
        // identical to a genuinely empty namespace/domain list unless the
        // *Failed flag is threaded through to distinguish "unknown" from "zero".
        render(
            <MemoryRouter>
                <MobileNavMenu
                    {...props}
                    namespaceCounts={[]}
                    domainCounts={[]}
                    namespacesFailed={true}
                    domainsFailed={true}
                />
            </MemoryRouter>
        );
        fireEvent.click(screen.getByText('Namespaces'));
        // No retry action exists here, so the copy must not promise one.
        expect(await screen.findByText("Couldn't load namespaces")).toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Back'));
        fireEvent.click(screen.getByText('Control Domains'));
        expect(await screen.findByText("Couldn't load control domains")).toBeInTheDocument();
    });

    describe('namespace tree', () => {
        it('nests a child namespace under its parent', async () => {
            renderMenu({ namespaceCounts: nestedNamespaceCounts, storage: createMemoryStorage() });
            fireEvent.click(screen.getByText('Namespaces'));

            expect(await screen.findByText('platform')).toBeInTheDocument();
            expect(screen.getByText('payments')).toBeInTheDocument();
        });

        it('expands and collapses the chevron in place, without changing level or closing the drawer', async () => {
            renderMenu({ namespaceCounts: nestedNamespaceCounts, storage: createMemoryStorage() });
            fireEvent.click(screen.getByText('Namespaces'));
            expect(await screen.findByText('payments')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Collapse platform'));
            expect(screen.queryByText('payments')).not.toBeInTheDocument();
            // Still on the namespaces level, drawer still open.
            expect(screen.getByRole('heading', { name: 'Namespaces' })).toBeInTheDocument();
            expect(props.onClose).not.toHaveBeenCalled();

            fireEvent.click(screen.getByLabelText('Expand platform'));
            expect(await screen.findByText('payments')).toBeInTheDocument();
        });

        it('shows the hidden descendant count only while a row is collapsed', async () => {
            renderMenu({ namespaceCounts: nestedNamespaceCounts, storage: createMemoryStorage() });
            fireEvent.click(screen.getByText('Namespaces'));
            expect(await screen.findByText('payments')).toBeInTheDocument();
            expect(screen.queryByTestId('nested-count-badge')).not.toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Collapse platform'));
            expect(screen.getByTestId('nested-count-badge')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Expand platform'));
            expect(await screen.findByText('payments')).toBeInTheDocument();
            expect(screen.queryByTestId('nested-count-badge')).not.toBeInTheDocument();
        });

        it("still opens the namespace's types list when its label is tapped", async () => {
            renderMenu({ namespaceCounts: nestedNamespaceCounts, storage: createMemoryStorage() });
            fireEvent.click(screen.getByText('Namespaces'));
            expect(await screen.findByText('payments')).toBeInTheDocument();

            fireEvent.click(screen.getByText('payments'));
            expect(await screen.findByText('Architectures')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'platform.payments' })).toBeInTheDocument();
        });

        it("does nothing when a group-only row's label is tapped, but its chevron still works", async () => {
            renderMenu({ namespaceCounts: nestedNamespaceCounts, storage: createMemoryStorage() });
            fireEvent.click(screen.getByText('Namespaces'));
            expect(await screen.findByText('platform')).toBeInTheDocument();

            fireEvent.click(screen.getByText('platform'));
            // No types level was opened — still on the namespaces list.
            expect(screen.getByRole('heading', { name: 'Namespaces' })).toBeInTheDocument();
            expect(screen.getByText('payments')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Collapse platform'));
            expect(screen.queryByText('payments')).not.toBeInTheDocument();
        });

        it('persists expansion state across a remount via injected storage', async () => {
            const storage = createMemoryStorage();
            const { unmount } = renderMenu({ namespaceCounts: nestedNamespaceCounts, storage });
            fireEvent.click(screen.getByText('Namespaces'));
            expect(await screen.findByText('payments')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Collapse platform'));
            expect(screen.queryByText('payments')).not.toBeInTheDocument();
            unmount();

            renderMenu({ namespaceCounts: nestedNamespaceCounts, storage });
            fireEvent.click(screen.getByText('Namespaces'));
            expect(await screen.findByText('platform')).toBeInTheDocument();
            expect(screen.queryByText('payments')).not.toBeInTheDocument();
        });
    });
});

describe('MobileNavMenu edit scope', () => {
    const abc = [
        { namespace: 'a', total: 1 },
        { namespace: 'a.b', total: 2 },
        { namespace: 'a.c', total: 3 },
    ] as NamespaceCounts[];

    const renderWithAccess = (grants: UserAccess[], storage: Storage = createMemoryStorage()) => {
        const service = { getCurrentUserAccess: () => Promise.resolve(grants) } as unknown as UserAccessService;
        return render(
            <UserAccessProvider service={service}>
                <MemoryRouter>
                    <MobileNavMenu {...props} namespaceCounts={abc} storage={storage} />
                </MemoryRouter>
            </UserAccessProvider>
        );
    };
    const grant = (namespace: string, permission: UserAccess['permission']): UserAccess => ({
        userAccessId: 0,
        username: 'alice',
        permission,
        namespace,
    });
    const rowLabels = () => screen.getAllByRole('listitem').map((li) => li.textContent);
    const selectCanEdit = async () => {
        fireEvent.click(await screen.findByRole('button', { name: 'Filter options' }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: 'Can edit' }));
    };
    const chip = () => screen.queryByRole('button', { name: 'Clear the Can edit filter' });

    it('shows the filter button in the header at the namespaces and domains levels, not the root', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Filter options' })).not.toBeInTheDocument());
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByRole('button', { name: 'Filter options' })).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Back'));
        fireEvent.click(screen.getByText('Control Domains'));
        expect(screen.getByRole('button', { name: 'Filter options' })).toBeInTheDocument();
    });

    it('shows the chip row only while Can edit is on', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        fireEvent.click(screen.getByText('Namespaces'));
        await screen.findByRole('button', { name: 'Filter options' });
        expect(chip()).not.toBeInTheDocument();

        await selectCanEdit();
        expect(chip()).toBeInTheDocument();

        fireEvent.click(chip()!);
        expect(chip()).not.toBeInTheDocument();
        expect(rowLabels()).toHaveLength(3);
    });

    it('keeps the scope when moving between levels', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        fireEvent.click(screen.getByText('Namespaces'));
        await selectCanEdit();
        fireEvent.click(screen.getByLabelText('Back'));
        fireEvent.click(screen.getByText('Control Domains'));
        expect(chip()).toBeInTheDocument();
        expect(screen.getByText('You cannot edit any control domains')).toBeInTheDocument();
    });

    it('starts with the choice remembered in storage', async () => {
        const storage = createMemoryStorage();
        storage.setItem('calmHub.editScope', 'editable');
        renderWithAccess([grant('a.c', 'write')], storage);
        fireEvent.click(screen.getByText('Namespaces'));
        expect(await screen.findByRole('button', { name: 'Clear the Can edit filter' })).toBeInTheDocument();
    });

    it('shows only the control domains the user can edit', async () => {
        const domainGrant: UserAccess = { userAccessId: 0, username: 'alice', permission: 'admin', domain: 'security' };
        renderWithAccess([domainGrant]);
        fireEvent.click(screen.getByText('Control Domains'));
        await selectCanEdit();
        expect(screen.getByText('security')).toBeInTheDocument();
    });

    it('hides the filter button when the user has no grants', async () => {
        renderMenu();
        fireEvent.click(screen.getByText('Namespaces'));
        await screen.findByText('finos');
        expect(screen.queryByRole('button', { name: 'Filter options' })).not.toBeInTheDocument();
    });

    it('shows editable namespaces with muted parents and no collapse chevrons', async () => {
        renderWithAccess([grant('a.c', 'write')]);
        fireEvent.click(screen.getByText('Namespaces'));
        await selectCanEdit();

        expect(rowLabels()).toEqual([expect.stringMatching(/^a/), expect.stringMatching(/^c/)]);
        expect(screen.getByText('a')).toHaveStyle({ color: colors.redesign.faintAlt });
        expect(screen.queryByRole('button', { name: /Collapse a/ })).not.toBeInTheDocument();
    });

    it('says so when the user cannot edit any namespace', async () => {
        renderWithAccess([grant('a', 'read')]);
        fireEvent.click(screen.getByText('Namespaces'));
        await selectCanEdit();
        expect(screen.getByText('You cannot edit any namespaces')).toBeInTheDocument();
    });
});
