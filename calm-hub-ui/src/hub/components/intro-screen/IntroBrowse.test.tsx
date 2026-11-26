import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IntroBrowse } from './IntroBrowse.js';
import { NamespaceCounts, DomainControlCount } from '../../../model/counts.js';
import { mockHeights, mockViewport } from '../../../test-support/layout-mocks.js';
import { UiConfigContext } from '../../../components/ui-config/UiConfigContext.js';
import { ChatProviderContext, ExtensionsContext } from '../../../extensions/ExtensionsContext.js';
import { fakeExtension, fakeExtensions } from '../../../test-support/fake-extensions.js';
import { UiNavigation } from '../../../model/ui-config.js';

const namespaceCounts: NamespaceCounts[] = [
    { namespace: 'finos', architectures: 2, patterns: 1, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 3 },
    { namespace: 'traderx', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 },
];
const domainCounts: DomainControlCount[] = [{ domain: 'security', controlCount: 4 }];

function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}</div>;
}

function renderBrowse(nc: NamespaceCounts[], dc: DomainControlCount[]) {
    return render(
        <MemoryRouter>
            <IntroBrowse namespaceCounts={nc} domainCounts={dc} />
            <LocationProbe />
        </MemoryRouter>
    );
}

describe('IntroBrowse', () => {
    it('renders a clickable tile per namespace and control domain', () => {
        renderBrowse(namespaceCounts, domainCounts);

        expect(screen.getByText('finos')).toBeInTheDocument();
        expect(screen.getByText('traderx')).toBeInTheDocument();
        expect(screen.getByText('security')).toBeInTheDocument();
        // Two namespace tiles, one domain tile.
        expect(screen.getAllByTestId('browse-namespace')).toHaveLength(2);
        expect(screen.getAllByTestId('browse-domain')).toHaveLength(1);
    });

    it('links a namespace tile to its namespace page', () => {
        renderBrowse(namespaceCounts, domainCounts);
        fireEvent.click(screen.getByText('finos'));
        expect(screen.getByTestId('location')).toHaveTextContent('/namespace/finos');
    });

    it('links a control-domain tile to its domain page', () => {
        renderBrowse(namespaceCounts, domainCounts);
        fireEvent.click(screen.getByText('security'));
        expect(screen.getByTestId('location')).toHaveTextContent('/domain/security');
    });

    it('clamps a namespace description and lifts the clamp on hover or focus', () => {
        const [finos, traderx] = namespaceCounts;
        renderBrowse([{ ...finos, description: 'FINOS reference architectures' }, traderx], domainCounts);

        const [finosTile] = screen.getAllByTestId('browse-namespace');
        const description = screen.getByText('FINOS reference architectures');
        expect(finosTile).toHaveClass('group');
        expect(description).toHaveClass('line-clamp-2', 'group-hover:line-clamp-none', 'group-focus-visible:line-clamp-none');
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    describe('on mobile', () => {
        let restore: () => void;
        beforeEach(() => {
            restore = mockViewport(true);
        });
        afterEach(() => {
            restore();
            vi.restoreAllMocks();
        });

        const renderWithDescription = () => {
            const [finos, traderx] = namespaceCounts;
            renderBrowse([{ ...finos, description: 'FINOS reference architectures' }, traderx], domainCounts);
        };

        it('toggles the full description when the text is cut off, with the toggle outside the link', () => {
            mockHeights(80, 40);
            renderWithDescription();
            const description = screen.getByText('FINOS reference architectures');
            const toggle = screen.getByRole('button', { name: 'Show more' });
            expect(toggle.closest('a')).toBeNull();
            expect(description).toHaveClass('line-clamp-2');

            fireEvent.click(toggle);
            expect(description).not.toHaveClass('line-clamp-2');
            expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
        });

        it('shows no toggle when the description fits', () => {
            mockHeights(40, 40);
            renderWithDescription();
            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });

        it('still links the tile to its namespace page', () => {
            mockHeights(80, 40);
            renderWithDescription();
            fireEvent.click(screen.getByText('finos'));
            expect(screen.getByTestId('location')).toHaveTextContent('/namespace/finos');
        });
    });

    it('gives the selected chat provider a card with its chat link, also when it has no other page', () => {
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={[fakeExtension(1, ['chat']), fakeExtension(2, ['chat'])]}>
                    <ChatProviderContext.Provider value={{ extension: 'ext-1', contribution: 'chat' }}>
                        <IntroBrowse namespaceCounts={[]} domainCounts={[]} />
                    </ChatProviderContext.Provider>
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        expect(screen.getByRole('link', { name: 'chat 1' })).toHaveAttribute('href', '/chat');
        expect(screen.queryByText('Extension 2')).not.toBeInTheDocument();
    });

    it('renders nothing when the catalogue is empty', () => {
        const { container } = renderBrowse([], []);
        expect(container.querySelector('[data-testid="browse-namespace"]')).toBeNull();
        expect(screen.queryByText('Namespaces')).not.toBeInTheDocument();
    });
});

describe('IntroBrowse navigation settings', () => {
    function renderWith(navigation: Partial<UiNavigation>, withExtension = true) {
        return render(
            <UiConfigContext.Provider value={{ navigation: { layout: 'menu', showNamespaces: true, showControlDomains: true, ...navigation } }}>
                <ExtensionsContext.Provider value={withExtension ? fakeExtensions(1) : []}>
                    <MemoryRouter>
                        <IntroBrowse namespaceCounts={namespaceCounts} domainCounts={domainCounts} />
                    </MemoryRouter>
                </ExtensionsContext.Provider>
            </UiConfigContext.Provider>
        );
    }

    it.each<[Partial<UiNavigation>, boolean, boolean, string | null]>([
        [{}, true, true, 'Extensions'],
        [{ showNamespaces: false }, false, true, 'Extensions'],
        [{ showControlDomains: false }, true, false, 'Extensions'],
        [{ showNamespaces: false, showControlDomains: false }, false, false, null],
        [{ showNamespaces: false, showControlDomains: false, extensionsHeading: 'Our tools' }, false, false, 'Our tools'],
    ])('with %o shows namespaces %s, control domains %s and the heading %s', (navigation, namespaces, domains, heading) => {
        renderWith(navigation);

        expect(screen.queryAllByTestId('browse-namespace')).toHaveLength(namespaces ? 2 : 0);
        expect(screen.queryByText('Namespaces')).toEqual(namespaces ? expect.anything() : null);
        expect(screen.queryAllByTestId('browse-domain')).toHaveLength(domains ? 1 : 0);
        expect(screen.queryByText('Control domains')).toEqual(domains ? expect.anything() : null);
        expect(screen.getByText('Extension 1')).toBeInTheDocument();
        if (heading) {
            expect(screen.getByText(heading)).toBeInTheDocument();
        } else {
            expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
        }
    });

    it('renders nothing when the only sections are hidden', () => {
        const { container } = renderWith({ showNamespaces: false, showControlDomains: false }, false);
        expect(container).toBeEmptyDOMElement();
    });
});
