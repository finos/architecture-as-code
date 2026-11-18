import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionMenuGroup } from '../../../components/navbar/ExtensionMenuGroup.js';
import { extensionNavLinks } from '../../../extensions/contributions.js';
import { ExtensionsContext } from '../../../extensions/ExtensionsContext.js';
import { ExtensionScreenPage } from '../../../extensions/ExtensionScreenPage.js';
import type { ExtensionSummary } from '../../../model/extensions.js';
import { ExtensionService } from '../../../service/extension-service.js';
import { fakeExtension, fakeExtensions, withScreens } from '../../../test-support/fake-extensions.js';
import { fakeImageAssets, logoSvg, svgDataUrl } from '../../../test-support/fake-image-assets.js';
import { ExtensionCard } from './ExtensionCard.js';
import { IntroBrowse } from './IntroBrowse.js';

vi.mock('../../../components/navbar/Navbar.js', () => ({ Navbar: () => <nav>Navbar</nav> }));
afterEach(() => vi.restoreAllMocks());

const stats = [
    { label: 'In flight', value: 1 },
    { label: 'Rolled back', value: 2 },
    { label: 'Reviews', value: 3 },
    { label: 'Hidden', value: 4 },
];

function renderCard(extension: ExtensionSummary) {
    return render(
        <MemoryRouter>
            <ExtensionCard extension={extension} links={extensionNavLinks(extension)} />
        </MemoryRouter>
    );
}

const links = (list: HTMLElement) => within(list).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);

describe('ExtensionCard', () => {
    it('shows the name, the provider, at most three figures and a link to the screen', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({
            hubApi: 0,
            blocks: [{ type: 'stats', items: stats }, { type: 'cards', items: [{ title: 'Not on the card' }] }],
        });
        renderCard(fakeExtension(1));
        const card = screen.getByTestId('browse-extension');
        expect(card.tagName).toBe('DIV');
        expect(card).toHaveTextContent('Extension 1');
        expect(card).toHaveTextContent('Provider 1');
        expect(links(screen.getByRole('list', { name: 'Extension 1' }))).toEqual([['screen 1', '/extensions/ext-1/screen']]);
        expect(await screen.findByText('Reviews')).toBeInTheDocument();
        expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
        expect(screen.queryByText('Not on the card')).not.toBeInTheDocument();
    });

    it('links to each screen in manifest order, under the landing card headline', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'alert', text: 'Two overdue' }] });
        renderCard(withScreens(fakeExtension(1, ['landing-card']), ['Reviews', 'Exceptions', 'Archive']));
        const list = screen.getByRole('list', { name: 'Extension 1' });
        expect(links(list)).toEqual([
            ['Reviews', '/extensions/ext-1/reviews'],
            ['Exceptions', '/extensions/ext-1/exceptions'],
            ['Archive', '/extensions/ext-1/archive'],
        ]);
        const headline = await screen.findByText('Two overdue');
        expect(headline.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows the logo at 20 px beside the name, and the marker while it loads, after it fails or without one, with the links in each case', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const assets = fakeImageAssets({
            '/api/calm/extensions/ext-1/logo/light': logoSvg('#0f766e'),
            '/api/calm/extensions/ext-2/logo/light': 500,
        });
        assets.mock.onGet('/api/calm/extensions/ext-3/logo/light').reply(() => new Promise(() => {}));
        const extensions: ExtensionSummary[] = [1, 2, 3].map((index) => ({ ...fakeExtension(index), logo: { light: 'logo.svg' } }));
        extensions.push(fakeExtension(4));
        render(assets.wrap(<MemoryRouter>{extensions.map((extension) => <ExtensionCard key={extension.id} extension={extension} links={extensionNavLinks(extension)} />)}</MemoryRouter>));
        const [loaded, failed, loading, none] = screen.getAllByTestId('browse-extension');
        await waitFor(() => expect(loaded.querySelector('img')).toHaveAttribute('src', svgDataUrl(logoSvg('#0f766e'))));
        fireEvent.load(loaded.querySelector('img')!);
        expect(within(loaded).getByTestId('extension-logo')).toHaveAttribute('data-state', 'loaded');
        expect(within(loaded).getByTestId('extension-logo')).toHaveStyle({ width: '20px', height: '20px' });
        await waitFor(() => expect(within(failed).getByTestId('extension-logo')).toHaveAttribute('data-state', 'failed'));
        expect(within(loading).getByTestId('extension-logo')).toHaveAttribute('data-state', 'loading');
        for (const card of [failed, loading]) expect(within(card).getByTestId('extension-marker')).toBeInTheDocument();
        expect(within(none).queryByTestId('extension-logo')).not.toBeInTheDocument();
        expect(within(none).getByTestId('extension-marker')).toHaveStyle({ width: '8px', height: '8px' });
        for (const [index, card] of [loaded, failed, loading, none].entries()) {
            expect(within(card).getByText(`Extension ${index + 1}`)).toBeVisible();
            expect(links(within(card).getByRole('list', { name: `Extension ${index + 1}` }))).toEqual([[`screen ${index + 1}`, `/extensions/ext-${index + 1}/screen`]]);
        }
    });

    it('uses the first landing card whose path needs no context value', async () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'alert', text: 'All clear' }] });
        const extension = fakeExtension(1);
        renderCard({
            ...extension,
            routes: [...extension.routes, { id: 'scoped', method: 'GET', path: '/namespaces/{namespace}/summary', scope: 'authenticated', readOnly: true }],
            contributes: {
                ...extension.contributes,
                'landing-card': [{ id: 'scoped', title: 'Scoped', route: 'scoped' }, ...extension.contributes['landing-card']!],
            },
        });
        expect(await screen.findByText('All clear')).toBeInTheDocument();
        expect(call.mock.calls.map(([, route]) => route.id)).toEqual(['data']);
    });

    it('shows an alert on one line when there is no stats block', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'alert', text: 'Rolling out' }] });
        renderCard(fakeExtension(1));
        expect(await screen.findByText('Rolling out')).toHaveClass('truncate');
    });

    it('wraps a very long name and provider to two lines, with the full text as a title', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        const name = 'N'.repeat(120);
        const provider = 'P'.repeat(120);
        renderCard({ ...fakeExtension(1), name, provider });
        for (const text of [screen.getByText(name), screen.getByText(provider)]) {
            expect(text).toHaveClass('line-clamp-2', 'wrap-anywhere');
            expect(text).not.toHaveClass('truncate');
        }
        expect(screen.getByText(name)).toHaveAttribute('title', name);
    });

    it('has no link without a screen, and needs no landing card', () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call');
        renderCard(fakeExtension(1, ['landing-card']));
        expect(screen.getByTestId('browse-extension')).toHaveTextContent('Extension 1');
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
        expect(screen.queryByRole('list')).not.toBeInTheDocument();
        renderCard(fakeExtension(2, ['screen']));
        expect(links(screen.getByRole('list', { name: 'Extension 2' }))).toEqual([['screen 2', '/extensions/ext-2/screen']]);
        expect(call).toHaveBeenCalledTimes(1);
    });

    it('wraps long screen titles in full, so that titles that differ only at the end stay distinct', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        const prefix = 'International architecture assurance and regulatory compliance review for retail banking systems in ';
        const titles = [`${prefix}North America`, `${prefix}South America`, 'T'.repeat(120)];
        renderCard(withScreens(fakeExtension(1, []), titles));
        for (const title of titles) {
            const text = screen.getByText(title);
            expect(text).toHaveClass('wrap-anywhere');
            expect(text).not.toHaveClass('line-clamp-2');
            expect(text).not.toHaveClass('truncate');
        }
        expect(screen.getByRole('link', { name: 'T'.repeat(120) })).toHaveAttribute('href', `/extensions/ext-1/${'t'.repeat(120)}`);
    });

    // jsdom has no layout, so these tests check the CSS that keeps the figures readable at 375 px:
    // one card for each row (about 295 px of content), one column for each figure, and labels that wrap.
    it('gives each figure an equal share of the card and wraps long labels and values', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({
            hubApi: 0,
            blocks: [{ type: 'stats', items: [{ label: 'In flight', value: 1 }, { label: 'Rolled back (30 days)', value: '2.1 days' }] }],
        });
        renderCard(fakeExtension(1));
        const label = await screen.findByText('Rolled back (30 days)');
        expect(screen.getByTestId('extension-card-figures').style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
        expect(label).not.toHaveClass('truncate');
        expect(label).toHaveClass('break-words');
        expect(screen.getByText('2.1 days')).not.toHaveClass('truncate');
    });

    it.each([
        ['a null item', [null]],
        ['an object value', [{ label: 'x', value: { n: 1 } }]],
    ])('shows the card without figures for %s', async (_, items) => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [{ type: 'stats', items }] });
        renderCard(fakeExtension(1));
        await waitFor(() => expect(call).toHaveBeenCalled());
        expect(screen.getByTestId('browse-extension')).toHaveTextContent('Extension 1');
        expect(screen.queryByTestId('extension-card-figures')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows only the valid figures of a stats block', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({
            hubApi: 0,
            blocks: [{ type: 'stats', items: [null, { label: 'x', value: { n: 1 } }, { label: 'Reviews', value: 3 }] }],
        });
        renderCard(fakeExtension(1));
        expect(await screen.findByText('Reviews')).toBeInTheDocument();
        expect(screen.getByTestId('extension-card-figures').style.gridTemplateColumns).toBe('repeat(1, minmax(0, 1fr))');
    });

    it('shows the card without figures when the request fails', async () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockRejectedValue(new Error('down'));
        renderCard(fakeExtension(1));
        await waitFor(() => expect(call).toHaveBeenCalled());
        expect(screen.getByTestId('browse-extension')).toHaveTextContent('Extension 1');
        expect(screen.queryByRole('term')).not.toBeInTheDocument();
    });
});

describe('IntroBrowse extensions', () => {
    it('shows an Extensions section under Namespaces, for extensions with a landing card or a screen', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={[...fakeExtensions(10), fakeExtension(11, ['detail-panel'])]}>
                    <IntroBrowse
                        namespaceCounts={[{ namespace: 'demo', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 }]}
                        domainCounts={[]}
                    />
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        const titles = screen.getAllByText(/^(Namespaces|Extensions)$/).map((el) => el.textContent);
        expect(titles).toEqual(['Namespaces', 'Extensions']);
        expect(screen.getAllByTestId('browse-extension')).toHaveLength(10);
    });

    it('puts the extension cards in one column on a phone, and keeps the tile grid for namespaces', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={fakeExtensions(3)}>
                    <IntroBrowse
                        namespaceCounts={[{ namespace: 'demo', architectures: 1, patterns: 0, flows: 0, standards: 0, adrs: 0, interfaces: 0, total: 1 }]}
                        domainCounts={[]}
                    />
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        const [namespaces, extensions] = screen.getAllByTestId('browse-grid');
        expect(namespaces).toHaveClass('grid-cols-2', 'sm:grid-cols-3');
        expect(extensions).toHaveClass('grid-cols-1', 'sm:grid-cols-2');
        expect(extensions).not.toHaveClass('grid-cols-2');
    });

    it('keeps the other cards when one card fails to render', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        const broken = { ...fakeExtension(1), name: { text: 'not a string' } } as unknown as ExtensionSummary;
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={[broken, fakeExtension(2)]}>
                    <IntroBrowse namespaceCounts={[]} domainCounts={[]} />
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        expect(screen.getByRole('alert')).toHaveTextContent('This extension sent content that CALM Hub cannot show.');
        expect(screen.getByTestId('browse-extension')).toHaveTextContent('Extension 2');
    });

    // Registry order that is not id order, a landing card with no screen, a screen title that two extensions use,
    // and an extension with neither a landing card nor a screen.
    const portfolio = [
        withScreens(fakeExtension(3, ['landing-card']), ['Architecture reviews', 'Exceptions']),
        fakeExtension(1, ['landing-card']),
        withScreens(fakeExtension(2, []), ['Overview', 'Release calendar']),
        withScreens(fakeExtension(4, []), ['Overview']),
        fakeExtension(5, ['detail-panel']),
    ];

    it('shows one card per extension with the labels, links and order of the side menu', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={portfolio}>
                    <IntroBrowse namespaceCounts={[]} domainCounts={[]} />
                    <ul data-testid="menu">
                        <ExtensionMenuGroup linkClassName={() => 'item'} />
                    </ul>
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        const groups = [
            ['Extension 3', [['Architecture reviews', '/extensions/ext-3/architecture-reviews'], ['Exceptions', '/extensions/ext-3/exceptions']]],
            ['Extension 2', [['Overview', '/extensions/ext-2/overview'], ['Release calendar', '/extensions/ext-2/release-calendar']]],
            ['Extension 4', [['Overview', '/extensions/ext-4/overview']]],
        ];
        const cards = screen.getAllByTestId('browse-extension');
        expect(cards.map((card) => card.textContent?.split('Provider')[0])).toEqual(['Extension 3', 'Extension 1', 'Extension 2', 'Extension 4']);
        expect(within(cards[1]).queryByRole('link')).not.toBeInTheDocument();
        for (const scope of [cards, [screen.getByTestId('menu')]]) {
            const lists = scope.flatMap((element) => within(element).queryAllByRole('list')).filter((list) => list.hasAttribute('aria-labelledby'));
            const labels = lists.map((list) => document.getElementById(list.getAttribute('aria-labelledby')!)?.textContent);
            expect(lists.map((list, index) => [labels[index], links(list)])).toEqual(groups);
        }
    });

    it('opens the screen of each card link', async () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        const targets = [
            ['Architecture reviews', 'ext-3', 'architecture-reviews'],
            ['Exceptions', 'ext-3', 'exceptions'],
            ['Overview', 'ext-2', 'overview'],
            ['Release calendar', 'ext-2', 'release-calendar'],
            ['Overview', 'ext-4', 'overview'],
        ];
        for (const [index, [title, extensionId, routeId]] of targets.entries()) {
            const { unmount } = render(
                <MemoryRouter>
                    <ExtensionsContext.Provider value={portfolio}>
                        <Routes>
                            <Route path="/" element={<IntroBrowse namespaceCounts={[]} domainCounts={[]} />} />
                            <Route path="/extensions/:extensionId/:contributionId" element={<ExtensionScreenPage />} />
                        </Routes>
                    </ExtensionsContext.Provider>
                </MemoryRouter>
            );
            const link = screen.getAllByRole('link')[index];
            expect(link).toHaveTextContent(title);
            call.mockClear();
            fireEvent.click(link);
            expect(await screen.findByRole('heading', { name: title, level: 1 })).toBeInTheDocument();
            await waitFor(() => expect(call).toHaveBeenCalledWith(extensionId, expect.objectContaining({ id: routeId }), {}, expect.anything()));
            expect(call).toHaveBeenCalledTimes(1);
            unmount();
        }
    });

    it('shows extensions on an empty catalogue', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={fakeExtensions(1, ['screen'])}>
                    <IntroBrowse namespaceCounts={[]} domainCounts={[]} />
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        expect(screen.getByTestId('browse-extension')).toBeInTheDocument();
    });
});
