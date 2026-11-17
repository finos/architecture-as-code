import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatProviderContext, ExtensionsContext } from '../../extensions/ExtensionsContext.js';
import { ExtensionScreenPage } from '../../extensions/ExtensionScreenPage.js';
import type { ChatProviderRef, ExtensionSummary } from '../../model/extensions.js';
import { ExtensionService } from '../../service/extension-service.js';
import { fakeExtension, fakeExtensions, withScreens } from '../../test-support/fake-extensions.js';
import { fakeImageAssets, logoSvg, svgDataUrl } from '../../test-support/fake-image-assets.js';
import { ExtensionMenuGroup } from './ExtensionMenuGroup.js';

vi.mock('./Navbar.js', () => ({ Navbar: () => <nav>Navbar</nav> }));
afterEach(() => vi.restoreAllMocks());

function renderGroup(
    extensions: ExtensionSummary[],
    { heading, onNavigate, chat }: { heading?: string; onNavigate?: () => void; chat?: ChatProviderRef } = { heading: 'Extensions' }
) {
    render(
        <MemoryRouter>
            <ExtensionsContext.Provider value={extensions}>
            <ChatProviderContext.Provider value={chat}>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <ul>
                                <li>Hub</li>
                                <ExtensionMenuGroup heading={heading} linkClassName={() => 'item'} onNavigate={onNavigate} />
                            </ul>
                        }
                    />
                    <Route path="/extensions/:extensionId/:contributionId" element={<ExtensionScreenPage />} />
                </Routes>
            </ChatProviderContext.Provider>
            </ExtensionsContext.Provider>
        </MemoryRouter>
    );
}

const links = (list: HTMLElement) => within(list).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);

describe('ExtensionMenuGroup', () => {
    it('groups the screens of each extension under its name, in registry order, after the existing items', () => {
        renderGroup([
            withScreens(fakeExtension(3, ['landing-card']), ['Reviews', 'Exceptions', 'Archive']),
            fakeExtension(1, ['landing-card', 'detail-panel']),
            fakeExtension(2),
        ]);
        const all = screen.getByRole('list', { name: 'Extensions' });
        expect(links(all)).toEqual([
            ['Reviews', '/extensions/ext-3/reviews'],
            ['Exceptions', '/extensions/ext-3/exceptions'],
            ['Archive', '/extensions/ext-3/archive'],
            ['screen 2', '/extensions/ext-2/screen'],
        ]);
        expect(links(within(all).getByRole('list', { name: 'Extension 3' })).map(([title]) => title)).toEqual(['Reviews', 'Exceptions', 'Archive']);
        expect(links(within(all).getByRole('list', { name: 'Extension 2' }))).toEqual([['screen 2', '/extensions/ext-2/screen']]);
        expect(screen.queryByText('Extension 1')).not.toBeInTheDocument();
        expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Hub');
    });

    it('opens the screen of its own extension when two extensions have a screen with the same title', async () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        renderGroup([withScreens(fakeExtension(1, []), ['Overview']), withScreens(fakeExtension(2, []), ['Overview'])]);
        fireEvent.click(within(screen.getByRole('list', { name: 'Extension 2' })).getByRole('link', { name: 'Overview' }));
        expect(await screen.findByRole('heading', { name: 'Overview', level: 1 })).toBeInTheDocument();
        await waitFor(() => expect(call).toHaveBeenCalledWith('ext-2', expect.objectContaining({ id: 'overview' }), {}, expect.anything()));
        expect(call.mock.calls.every(([id]) => id === 'ext-2')).toBe(true);
    });

    it('labels the group of an extension with the id "heading" by its name, not by the heading', () => {
        renderGroup([{ ...withScreens(fakeExtension(1, []), ['Overview']), id: 'heading', name: 'Assurance' }]);
        const all = screen.getByRole('list', { name: 'Extensions' });
        expect(links(within(all).getByRole('list', { name: 'Assurance' }))).toEqual([['Overview', '/extensions/heading/overview']]);
    });

    it('shows long screen titles in full, so that titles that differ only at the end stay distinct', () => {
        const prefix = 'International architecture assurance and regulatory compliance review for retail banking systems in ';
        const titles = [`${prefix}North America`, `${prefix}South America`];
        renderGroup([withScreens(fakeExtension(1, []), titles)]);
        for (const title of titles) {
            const text = screen.getByText(title);
            expect(text).toHaveClass('wrap-anywhere');
            expect(text).not.toHaveClass('line-clamp-2');
            expect(text).not.toHaveClass('truncate');
        }
        expect(links(screen.getByRole('list', { name: 'Extension 1' })).map(([title]) => title)).toEqual(titles);
    });

    it('labels the groups by extension name when there is no heading', () => {
        renderGroup(fakeExtensions(2), {});
        expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
        expect(within(screen.getByRole('list', { name: 'Extension 2' })).getByRole('link')).toHaveAttribute('href', '/extensions/ext-2/screen');
    });

    it('wraps a long extension name to two lines, with the full name as a title', () => {
        const name = 'N'.repeat(120);
        renderGroup([{ ...fakeExtension(1), name }]);
        expect(screen.getByText(name)).toHaveClass('line-clamp-2', 'wrap-anywhere');
        expect(screen.getByText(name)).toHaveAttribute('title', name);
        expect(screen.getByRole('list', { name })).toBeInTheDocument();
    });

    it('shows each extension logo at 16 px beside its group name, and the marker while a logo loads, after it fails or without one', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const assets = fakeImageAssets({
            '/api/calm/extensions/ext-1/logo/light': logoSvg('#0f766e'),
            '/api/calm/extensions/ext-2/logo/light': 500,
        });
        assets.mock.onGet('/api/calm/extensions/ext-3/logo/light').reply(() => new Promise(() => {}));
        const logo = { light: 'logo.svg' };
        render(
            assets.wrap(
                <MemoryRouter>
                    <ExtensionsContext.Provider
                        value={[{ ...fakeExtension(1), logo }, { ...fakeExtension(2), logo }, { ...fakeExtension(3), logo }, fakeExtension(4)]}
                    >
                        <ul>
                            <ExtensionMenuGroup heading="Extensions" linkClassName={() => 'item'} />
                        </ul>
                    </ExtensionsContext.Provider>
                </MemoryRouter>
            )
        );
        // The group label is the name only: the logo is decorative.
        const label = (index: number) => screen.getByRole('list', { name: `Extension ${index}` }).previousElementSibling as HTMLElement;
        await waitFor(() => expect(label(1).querySelector('img')).toHaveAttribute('src', svgDataUrl(logoSvg('#0f766e'))));
        fireEvent.load(label(1).querySelector('img')!);
        expect(within(label(1)).getByTestId('extension-logo')).toHaveAttribute('data-state', 'loaded');
        expect(within(label(1)).getByTestId('extension-logo')).toHaveStyle({ width: '16px', height: '16px' });
        await waitFor(() => expect(within(label(2)).getByTestId('extension-logo')).toHaveAttribute('data-state', 'failed'));
        expect(within(label(3)).getByTestId('extension-logo')).toHaveAttribute('data-state', 'loading');
        for (const index of [2, 3]) expect(within(label(index)).getByTestId('extension-marker')).toBeInTheDocument();
        expect(within(label(4)).queryByTestId('extension-logo')).not.toBeInTheDocument();
        expect(within(label(4)).getByTestId('extension-marker')).toHaveStyle({ width: '8px', height: '8px' });
        for (const index of [1, 2, 3, 4]) {
            expect(label(index)).toHaveTextContent(`Extension ${index}`);
            expect(links(screen.getByRole('list', { name: `Extension ${index}` }))).toEqual([[`screen ${index}`, `/extensions/ext-${index}/screen`]]);
        }
    });

    it('closes the menu on navigation', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        const onNavigate = vi.fn();
        renderGroup(fakeExtensions(1), { heading: 'Extensions', onNavigate });
        fireEvent.click(screen.getByRole('link'));
        expect(onNavigate).toHaveBeenCalled();
    });

    it('adds the chat link to the group of the selected chat provider only, also when it has no screen', () => {
        renderGroup([fakeExtension(1), fakeExtension(2, ['chat']), fakeExtension(3, ['chat'])], {
            heading: 'Extensions',
            chat: { extension: 'ext-2', contribution: 'chat' },
        });
        expect(links(screen.getByRole('list', { name: 'Extensions' }))).toEqual([
            ['screen 1', '/extensions/ext-1/screen'],
            ['chat 2', '/chat'],
        ]);
        expect(screen.queryByText('Extension 3')).not.toBeInTheDocument();
    });

    it('adds no chat link when the selected chat entry is not in the registry', () => {
        renderGroup([fakeExtension(2, ['chat'])], { heading: 'Extensions', chat: { extension: 'ext-2', contribution: 'gone' } });
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders nothing without a screen', () => {
        renderGroup(fakeExtensions(2, ['landing-card', 'detail-panel', 'action']));
        expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
});
