import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsContext } from '../../../extensions/ExtensionsContext.js';
import type { ExtensionSummary } from '../../../model/extensions.js';
import { ExtensionService } from '../../../service/extension-service.js';
import { fakeExtension, fakeExtensions } from '../../../test-support/fake-extensions.js';
import { ExtensionCard } from './ExtensionCard.js';
import { IntroBrowse } from './IntroBrowse.js';

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
            <ExtensionCard extension={extension} />
        </MemoryRouter>
    );
}

describe('ExtensionCard', () => {
    it('shows the name, the provider and at most three figures, and opens the first screen', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({
            hubApi: 0,
            blocks: [{ type: 'stats', items: stats }, { type: 'cards', items: [{ title: 'Not on the card' }] }],
        });
        renderCard(fakeExtension(1));
        const card = screen.getByTestId('browse-extension');
        expect(card).toHaveAttribute('href', '/extensions/ext-1/screen');
        expect(card).toHaveTextContent('Extension 1');
        expect(card).toHaveTextContent('Provider 1');
        expect(await screen.findByText('Reviews')).toBeInTheDocument();
        expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
        expect(screen.queryByText('Not on the card')).not.toBeInTheDocument();
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

    it('is not a link without a screen, and needs no landing card', () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call');
        renderCard(fakeExtension(1, ['landing-card']));
        expect(screen.getByTestId('browse-extension').tagName).toBe('DIV');
        renderCard(fakeExtension(2, ['screen']));
        expect(screen.getAllByTestId('browse-extension')[1]).toHaveAttribute('href', '/extensions/ext-2/screen');
        expect(call).toHaveBeenCalledTimes(1);
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
