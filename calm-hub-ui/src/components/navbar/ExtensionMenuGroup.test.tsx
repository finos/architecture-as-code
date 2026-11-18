import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ExtensionsContext } from '../../extensions/ExtensionsContext.js';
import type { ExtensionSummary } from '../../model/extensions.js';
import { fakeExtension, fakeExtensions } from '../../test-support/fake-extensions.js';
import { fakeImageAssets, logoSvg, svgDataUrl } from '../../test-support/fake-image-assets.js';
import { ExtensionMenuGroup } from './ExtensionMenuGroup.js';

function renderGroup(extensions: ExtensionSummary[], onNavigate = vi.fn()) {
    render(
        <MemoryRouter>
            <ExtensionsContext.Provider value={extensions}>
                <ul>
                    <li>Hub</li>
                    <ExtensionMenuGroup linkClassName={() => 'item'} onNavigate={onNavigate} />
                </ul>
            </ExtensionsContext.Provider>
        </MemoryRouter>
    );
    return onNavigate;
}

describe('ExtensionMenuGroup', () => {
    it('lists one entry per extension screen under an Extensions heading, after the existing items', () => {
        renderGroup(fakeExtensions(10));
        const group = screen.getByRole('list', { name: 'Extensions' });
        const links = within(group).getAllByRole('link');
        expect(links).toHaveLength(10);
        expect(links[0]).toHaveAttribute('href', '/extensions/ext-1/screen');
        expect(links[0]).toHaveTextContent('screen 1');
        expect(links[0]).toHaveTextContent('Extension 1');
        const outer = screen.getAllByRole('listitem')[0];
        expect(outer).toHaveTextContent('Hub');
    });

    it('closes the menu on navigation', () => {
        const onNavigate = renderGroup(fakeExtensions(1));
        screen.getByRole('link').click();
        expect(onNavigate).toHaveBeenCalled();
    });

    it('shows the logo of an extension that has one, and keeps the link name and the marker of the others', async () => {
        const assets = fakeImageAssets({ '/api/calm/extensions/ext-1/logo/light': logoSvg('#0f766e') });
        render(
            assets.wrap(
                <MemoryRouter>
                    <ExtensionsContext.Provider value={[{ ...fakeExtension(1), logo: { light: 'logo.svg' } }, fakeExtension(2)]}>
                        <ul>
                            <ExtensionMenuGroup linkClassName={() => 'item'} />
                        </ul>
                    </ExtensionsContext.Provider>
                </MemoryRouter>
            )
        );
        const [withLogo, withoutLogo] = within(screen.getByRole('list', { name: 'Extensions' })).getAllByRole('link');
        await waitFor(() => expect(withLogo.querySelector('img')).toHaveAttribute('src', svgDataUrl(logoSvg('#0f766e'))));
        // The logo adds nothing to the link name: it is the visible text only.
        expect(withLogo).toHaveAccessibleName(withLogo.textContent!);
        expect(withLogo.textContent).toContain('Extension 1');
        expect(within(withoutLogo).getByTestId('extension-marker')).toBeInTheDocument();
        expect(withoutLogo).toHaveAccessibleName(withoutLogo.textContent!);
    });

    it('renders nothing without a screen', () => {
        renderGroup(fakeExtensions(2, ['landing-card']));
        expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
    });
});
