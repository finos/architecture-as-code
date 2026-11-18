import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { Navbar } from './Navbar.js';
import { UserAccessContext } from '../../admin/context/UserAccessContext.js';
import { CurrentUserAccessState } from '../../admin/hooks/useCurrentUserAccess.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { THEME_STORAGE_KEY } from '../../theme/useTheme.js';
import { UiConfigContext } from '../ui-config/UiConfigContext.js';
import { UiConfigStatusContext } from '../ui-config/ui-config-status.js';
import { ExtensionsContext } from '../../extensions/ExtensionsContext.js';
import { fakeExtensions } from '../../test-support/fake-extensions.js';
import { UiConfig } from '../../model/ui-config.js';
import { fakeImageAssets, logoSvg, svgDataUrl } from '../../test-support/fake-image-assets.js';

/**
 * jsdom has no modal dialogs. This models what a browser does: showModal() and close(), Escape on a modal dialog fires
 * `cancel`, and while a dialog is modal, focus() on an element outside it does nothing.
 */
function modelModalDialogs() {
    const focus = HTMLElement.prototype.focus;
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value(this: HTMLDialogElement) {
            this.setAttribute('open', '');
            this.setAttribute('data-modal', '');
        },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
        configurable: true,
        value(this: HTMLDialogElement) {
            this.removeAttribute('open');
            this.removeAttribute('data-modal');
            this.dispatchEvent(new Event('close'));
        },
    });
    const onEscape = (event: KeyboardEvent) => {
        const modal = document.querySelector('dialog[data-modal]');
        if (event.key === 'Escape' && modal?.dispatchEvent(new Event('cancel', { cancelable: true }))) (modal as HTMLDialogElement).close();
    };
    document.addEventListener('keydown', onEscape);
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
        const modal = document.querySelector('dialog[data-modal]');
        if (modal && !modal.contains(this)) return;
        focus.call(this, options);
    });
    return () => {
        document.removeEventListener('keydown', onEscape);
        delete (HTMLDialogElement.prototype as { showModal?: unknown }).showModal;
        delete (HTMLDialogElement.prototype as { close?: unknown }).close;
        vi.mocked(HTMLElement.prototype.focus).mockRestore();
    };
}

function makeState(overrides: Partial<CurrentUserAccessState>): CurrentUserAccessState {
    return {
        grants: [],
        loading: false,
        error: null,
        isGlobalAdmin: false,
        canAdminNamespace: () => false,
        ...overrides,
    };
}

function renderNavbar(state: CurrentUserAccessState, storage: Storage = createMemoryStorage(), uiConfig: UiConfig = {}) {
    return render(
        <UserAccessContext.Provider value={state}>
            <UiConfigContext.Provider value={uiConfig}>
                <MemoryRouter>
                    <Navbar storage={storage} />
                </MemoryRouter>
            </UiConfigContext.Provider>
        </UserAccessContext.Provider>
    );
}

describe('Navbar menu button', () => {
    it('always renders the hamburger menu button', () => {
        renderNavbar(makeState({}));
        expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });

    it('opens the destinations overlay when the menu button is clicked', async () => {
        renderNavbar(makeState({}));
        const overlay = screen.getByRole('dialog', { hidden: true });
        expect(overlay).not.toHaveAttribute('open');
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(overlay).toHaveAttribute('open');
    });

    it('shows the Home link in the open menu', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^home$/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /^visualizer$/i })).not.toBeInTheDocument();
    });

    it('closes the overlay with its close button and gives the focus back to the menu button', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        await userEvent.click(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name: /close menu/i }));
        expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
        expect(screen.getByRole('button', { name: /open menu/i })).toHaveFocus();
    });

    it('opens as a modal dialog that takes the focus, keeps Tab inside it and closes on Escape', async () => {
        const restore = modelModalDialogs();
        const user = userEvent.setup();
        renderNavbar(makeState({ isGlobalAdmin: true }));
        await user.click(screen.getByRole('button', { name: /open menu/i }));
        const menu = screen.getByRole('dialog', { name: 'Menu' });
        expect(menu).toHaveAttribute('data-modal');
        const close = within(menu).getByRole('button', { name: /close menu/i });
        const home = within(menu).getByRole('link', { name: /^home$/i });
        const admin = within(menu).getByRole('link', { name: /^admin$/i });
        expect(close).toHaveFocus();
        await user.tab();
        expect(home).toHaveFocus();
        await user.tab();
        expect(admin).toHaveFocus();
        await user.tab();
        expect(close).toHaveFocus();
        await user.tab({ shift: true });
        expect(admin).toHaveFocus();
        // The page behind the modal is inert: it cannot take the focus.
        screen.getByRole('button', { name: /switch to dark theme/i }).focus();
        expect(admin).toHaveFocus();
        await user.keyboard('{Escape}');
        expect(menu).not.toHaveAttribute('open');
        expect(screen.getByRole('button', { name: /open menu/i })).toHaveFocus();
        restore();
    });

    it('closes on a click on the backdrop, but not on a click inside the menu', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        const menu = screen.getByRole('dialog', { name: 'Menu' });
        await userEvent.click(within(menu).getByRole('heading', { name: 'Menu' }));
        expect(menu).toHaveAttribute('open');
        // A click on ::backdrop has the dialog itself as its target.
        await userEvent.click(menu);
        expect(menu).not.toHaveAttribute('open');
    });
});

describe('Navbar Admin link visibility', () => {
    it('shows the Admin link in the open menu for a global admin', async () => {
        renderNavbar(makeState({ isGlobalAdmin: true }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^admin$/i })).toBeInTheDocument();
    });

    it('shows the Admin link in the open menu for a namespace-scoped admin', async () => {
        renderNavbar(makeState({
            grants: [{ userAccessId: 1, username: 'bob', permission: 'admin', namespace: 'finos' }],
        }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('link', { name: /^admin$/i })).toBeInTheDocument();
    });

    it('hides the Admin link in the open menu for a read-only user', async () => {
        renderNavbar(makeState({
            grants: [{ userAccessId: 1, username: 'carol', permission: 'read', namespace: 'finos' }],
        }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('hides the Admin link in the open menu while access is loading', async () => {
        renderNavbar(makeState({ loading: true }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });

    it('hides the Admin link in the open menu when user has no grants', async () => {
        renderNavbar(makeState({ grants: [] }));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByRole('link', { name: /^admin$/i })).not.toBeInTheDocument();
    });
});

describe('Navbar theme', () => {
    it('renders the theme toggle', () => {
        renderNavbar(makeState({}));
        expect(screen.getByRole('button', { name: /switch to .* theme/i })).toBeInTheDocument();
    });

    it('shows the two-tone lockup on light', () => {
        renderNavbar(makeState({}));
        expect(screen.getByAltText('CALM Logo')).toHaveAttribute(
            'src',
            '/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo.svg'
        );
    });

    it('swaps to the white lockup on dark, which the navy one would not survive', () => {
        const storage = createMemoryStorage();
        storage.setItem(THEME_STORAGE_KEY, 'dark');

        renderNavbar(makeState({}), storage);

        expect(screen.getByAltText('CALM Logo')).toHaveAttribute(
            'src',
            '/brand/Horizontal/2025_CALM_Horizontal_Navbar_Logo_WHT.svg'
        );
    });

    it('uses a navbar lockup — never the full one with the tagline — in either theme', () => {
        const dark = createMemoryStorage();
        dark.setItem(THEME_STORAGE_KEY, 'dark');

        for (const storage of [createMemoryStorage(), dark]) {
            const { unmount } = renderNavbar(makeState({}), storage);
            expect(screen.getByAltText('CALM Logo').getAttribute('src')).toContain('Navbar_Logo');
            unmount();
        }
    });

    it('swaps the logo when the toggle is pressed, keeping it in step with the theme', async () => {
        renderNavbar(makeState({}));
        expect(screen.getByAltText('CALM Logo').getAttribute('src')).not.toContain('WHT');

        await userEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));

        // Guards against Navbar and ThemeToggle each holding their own useTheme state.
        expect(screen.getByAltText('CALM Logo').getAttribute('src')).toContain('WHT');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
});

describe('Navbar UI config', () => {
    it('shows no environment pill or menu info when nothing is configured', async () => {
        renderNavbar(makeState({}));
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.queryByTestId('environment-pill')).not.toBeInTheDocument();
        expect(screen.queryByText('Signed in as')).not.toBeInTheDocument();
    });

    it('shows the environment pill in the header without opening the menu', () => {
        renderNavbar(makeState({}), createMemoryStorage(), { environment: { name: 'UAT', colour: 'warning' } });
        expect(screen.getByTestId('environment-pill')).toHaveTextContent('UAT');
        expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
    });

    it('shows the identity and items in the open menu', async () => {
        renderNavbar(makeState({}), createMemoryStorage(), {
            identity: { name: 'alice' },
            items: [{ label: 'Support', url: 'https://support.example.com' }],
        });
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        const menu = screen.getByRole('dialog');
        expect(menu).toHaveTextContent('Signed in as');
        expect(menu).toHaveTextContent('alice');
        expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', 'https://support.example.com');
    });
});

// jsdom does no layout, so these guard the classes that set it (#3505).
describe('Navbar layout', () => {
    it('keeps the logo in the layout flow, so page actions cannot cover it', () => {
        renderNavbar(makeState({}));
        const center = screen.getByRole('link', { name: 'CALM Hub home' }).parentElement;

        expect(center).toHaveClass('max-lg:shrink', 'min-w-0');
        expect(center.className).not.toMatch(/absolute|translate/);
        expect(screen.getByAltText('CALM Logo')).toHaveClass('object-contain');
    });

    it('stops the side groups shrinking under their content', () => {
        const { container } = renderNavbar(makeState({}));

        for (const side of [container.querySelector('.navbar-start'), container.querySelector('.navbar-end')]) {
            expect(side).toHaveClass('w-auto', 'max-lg:flex-1');
            expect(side?.className).not.toMatch(/min-w-0/);
        }
    });

    it('uses a three-column grid from lg so a wide side moves the logo instead of covering it', () => {
        const { container } = renderNavbar(makeState({}));

        expect(container.querySelector('.navbar')).toHaveClass(
            'lg:grid',
            'lg:grid-cols-[minmax(auto,1fr)_auto_minmax(auto,1fr)]',
        );
    });
});

const LIGHT = '/api/calm/ui/branding/logo/light?v=1';
const DARK = '/api/calm/ui/branding/logo/dark?v=1';
const NORTHSTAR: UiConfig = {
    branding: {
        organisationName: 'Northstar Financial',
        applicationName: 'Architecture Hub',
        logo: { light: LIGHT, dark: DARK },
    },
};
const LOGO_ONLY: UiConfig = { branding: { logo: { light: LIGHT } } };

function renderBranded(uiConfig: UiConfig, replies: Record<string, string | number>, theme: 'light' | 'dark' = 'light') {
    const storage = createMemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, theme);
    const assets = fakeImageAssets(replies);
    render(
        assets.wrap(
            <UiConfigContext.Provider value={uiConfig}>
                <MemoryRouter>
                    <Navbar storage={storage} />
                </MemoryRouter>
            </UiConfigContext.Provider>
        )
    );
    return assets;
}

/** Reports a wide or narrow screen and the light colour scheme, whatever else is asked. */
function mockWidth(mobile: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width') ? mobile : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    return () => {
        window.matchMedia = original;
    };
}

describe('Navbar branding', () => {
    it('shows the organisation lockup instead of the CALM logo, named for the home link', async () => {
        renderBranded(NORTHSTAR, { [LIGHT]: logoSvg('#0f766e') });

        const home = screen.getByRole('link', { name: 'Northstar Financial home' });
        expect(home).toHaveTextContent('Northstar Financial');
        expect(home).toHaveTextContent('Architecture Hub');
        await waitFor(() => expect(home.querySelector('img')).toHaveAttribute('src', svgDataUrl(logoSvg('#0f766e'))));
        expect(screen.queryByAltText('CALM Logo')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search Northstar Financial… e.g. namespace:finos type:pattern')).toBeInTheDocument();
    });

    it('uses the dark logo on dark, without a plate', async () => {
        const assets = renderBranded(NORTHSTAR, { [DARK]: logoSvg('#ffffff') }, 'dark');

        const logo = await waitFor(() => within(screen.getByRole('link', { name: /home$/ })).getByRole('presentation'));
        expect(logo).toHaveAttribute('src', svgDataUrl(logoSvg('#ffffff')));
        expect(logo).not.toHaveClass('bg-white');
        expect(assets.mock.history.get.map((request) => request.url)).toEqual([DARK]);
    });

    it('shows a light-only logo on a light plate on dark, because the logo may be dark', async () => {
        renderBranded(LOGO_ONLY, { [LIGHT]: logoSvg('#000063') }, 'dark');

        const logo = await screen.findByAltText('Organisation logo');
        expect(logo).toHaveAttribute('src', svgDataUrl(logoSvg('#000063')));
        expect(logo).toHaveClass('bg-white');
    });

    it('keeps the names when the logo request fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const assets = renderBranded(NORTHSTAR, { [LIGHT]: 500 });

        await waitFor(() => expect(assets.mock.history.get).toHaveLength(1));
        const home = screen.getByRole('link', { name: 'Northstar Financial home' });
        await waitFor(() => expect(home).toHaveTextContent('Northstar Financial'));
        expect(home.querySelector('img')).toBeNull();
        vi.restoreAllMocks();
    });

    it('keeps the names when the browser refuses a loaded logo', async () => {
        renderBranded(NORTHSTAR, { [LIGHT]: logoSvg('#0f766e') });
        const home = screen.getByRole('link', { name: 'Northstar Financial home' });
        const logo = await waitFor(() => within(home).getByRole('presentation'));

        fireEvent.error(logo);

        expect(home.querySelector('img')).toBeNull();
        expect(home).toHaveTextContent('Northstar Financial');
    });

    it('waits for a logo without names, and shows the CALM logo if the browser refuses it', async () => {
        renderBranded(LOGO_ONLY, { [LIGHT]: logoSvg('#0f766e') });

        expect(screen.getByTestId('brand-placeholder')).toBeInTheDocument();
        expect(screen.queryByAltText('CALM Logo')).not.toBeInTheDocument();
        fireEvent.error(await screen.findByAltText('Organisation logo'));

        expect(screen.getByAltText('CALM Logo')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'CALM Hub home' })).toBeInTheDocument();
    });

    it('shows the CALM logo when a logo without names fails to load', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        renderBranded(LOGO_ONLY, { [LIGHT]: 404 });

        expect(await screen.findByAltText('CALM Logo')).toBeInTheDocument();
        vi.restoreAllMocks();
    });

    it('keeps the logo space empty while the config loads, so a branded Hub does not show CALM first', () => {
        render(
            <UiConfigStatusContext.Provider value="loading">
                <MemoryRouter>
                    <Navbar storage={createMemoryStorage()} />
                </MemoryRouter>
            </UiConfigStatusContext.Provider>
        );

        expect(screen.getByTestId('brand-placeholder')).toBeInTheDocument();
        expect(screen.queryByAltText('CALM Logo')).not.toBeInTheDocument();
    });
});

describe('Navbar navigation settings', () => {
    const sidebar: UiConfig = { navigation: { layout: 'sidebar', showNamespaces: true, showControlDomains: true } };

    it('has no menu button or drawer in the sidebar layout on a wide screen', () => {
        const restore = mockWidth(false);
        renderNavbar(makeState({}), createMemoryStorage(), sidebar);

        expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('dialog', { hidden: true })).not.toBeInTheDocument();
        restore();
    });

    it('keeps the drawer in the sidebar layout on a narrow screen', async () => {
        const restore = mockWidth(true);
        renderNavbar(makeState({}), createMemoryStorage(), sidebar);

        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));
        expect(screen.getByRole('dialog', { name: 'Menu' })).toHaveAttribute('open');
        restore();
    });

    it.each<[string, Partial<NonNullable<UiConfig['navigation']>>, string | null]>([
        ['both built-in sections show', {}, 'Extensions'],
        ['only control domains show', { showNamespaces: false }, 'Extensions'],
        ['both built-in sections are hidden', { showNamespaces: false, showControlDomains: false }, null],
        ['the operator names the group', { showNamespaces: false, showControlDomains: false, extensionsHeading: 'Services' }, 'Services'],
    ])('heads the extension screens correctly when %s', async (_, navigation, heading) => {
        render(
            <UserAccessContext.Provider value={makeState({})}>
                <UiConfigContext.Provider value={{ navigation: { layout: 'menu', showNamespaces: true, showControlDomains: true, ...navigation } }}>
                    <ExtensionsContext.Provider value={fakeExtensions(1)}>
                        <MemoryRouter>
                            <Navbar storage={createMemoryStorage()} />
                        </MemoryRouter>
                    </ExtensionsContext.Provider>
                </UiConfigContext.Provider>
            </UserAccessContext.Provider>
        );
        await userEvent.click(screen.getByRole('button', { name: /open menu/i }));

        expect(screen.getByRole('link', { name: /screen 1/ })).toBeInTheDocument();
        if (heading) {
            expect(screen.getByRole('list', { name: heading })).toBeInTheDocument();
        } else {
            expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
        }
    });
});
