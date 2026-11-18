import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { UiConfigContext } from '../ui-config/UiConfigContext.js';
import { NavigationLayout } from '../../model/ui-config.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { THEME_STORAGE_KEY } from '../../theme/useTheme.js';
import { AppLayout } from './AppLayout.js';

const original = window.matchMedia;

/** Without `storage` in `props`, AppLayout uses its default. */
function renderLayout(layout: NavigationLayout, mobile: boolean, props: { storage?: Storage } = { storage: createMemoryStorage() }) {
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width') ? mobile : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    return render(
        <UiConfigContext.Provider value={{ navigation: { layout, showNamespaces: true, showControlDomains: true } }}>
            <MemoryRouter>
                <AppLayout {...props}>
                    <p>Page</p>
                </AppLayout>
            </MemoryRouter>
        </UiConfigContext.Provider>
    );
}

describe('AppLayout', () => {
    afterEach(() => {
        window.matchMedia = original;
    });

    it('shows the menu beside the page in the sidebar layout on a wide screen', () => {
        renderLayout('sidebar', false);

        expect(screen.getByRole('navigation', { name: 'Main' })).toContainElement(screen.getByRole('link', { name: 'Home' }));
        expect(screen.getByText('Page')).toBeInTheDocument();
    });

    it('collapses by keyboard, retains focus, and remembers the choice after another page mounts', async () => {
        const storage = createMemoryStorage();
        const view = renderLayout('sidebar', false, { storage });
        const user = userEvent.setup();
        screen.getByRole('button', { name: 'Collapse navigation' }).focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.getByText('Page')).toBeVisible();
        view.unmount();
        renderLayout('sidebar', false, { storage });
        await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
        expect(screen.getByRole('link', { name: 'Home' })).toBeVisible();
    });

    it('still toggles when storage is unavailable', async () => {
        const storage = {
            getItem: () => {
                throw new Error('Blocked');
            },
            setItem: () => {
                throw new Error('Blocked');
            },
        } as unknown as Storage;
        renderLayout('sidebar', false, { storage });
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Collapse navigation' }));
        await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
        expect(screen.getByRole('link', { name: 'Home' })).toBeVisible();
    });

    it.each<[NavigationLayout, boolean]>([
        ['sidebar', true],
        ['menu', false],
    ])('keeps the menu in the drawer in the %s layout when mobile is %s', (layout, mobile) => {
        renderLayout(layout, mobile);

        expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /collapse navigation|expand navigation/i })).not.toBeInTheDocument();
    });
});

describe('AppLayout with the default storage', () => {
    afterEach(() => {
        window.matchMedia = original;
    });

    /** When the browser blocks site data, reading the `localStorage` global itself throws. */
    function blockLocalStorage() {
        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            get() {
                throw new DOMException('denied', 'SecurityError');
            },
        });
        return () => {
            if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
        };
    }

    it.each<[string, NavigationLayout, boolean]>([
        ['the sidebar on a wide screen', 'sidebar', false],
        ['the menu on a narrow screen', 'menu', true],
    ])('renders %s, and its theme and menu controls work, when reading localStorage throws', async (_, layout, mobile) => {
        const restore = blockLocalStorage();
        try {
            expect(() => localStorage).toThrow(DOMException);
            renderLayout(layout, mobile, {});
            const user = userEvent.setup();
            expect(screen.getByText('Page')).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
            expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
            await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
            expect(document.documentElement).toHaveAttribute('data-theme', 'light');

            if (mobile) {
                await user.click(screen.getByRole('button', { name: 'Open menu' }));
                expect(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('link', { name: 'Home' })).toBeInTheDocument();
            } else {
                await user.click(screen.getByRole('button', { name: 'Collapse navigation' }));
                expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
                await user.click(screen.getByRole('button', { name: 'Expand navigation' }));
                expect(screen.getByRole('link', { name: 'Home' })).toBeVisible();
            }
        } finally {
            restore();
        }
    });

    it('keeps the menu and theme choices in localStorage when the browser allows it', async () => {
        renderLayout('sidebar', false, {});
        const user = userEvent.setup();

        await user.click(screen.getByRole('button', { name: 'Collapse navigation' }));
        await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }));

        expect(localStorage.getItem('calm-navigation-collapsed')).toBe('true');
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });
});
