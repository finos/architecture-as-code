import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { UiConfigContext } from '../ui-config/UiConfigContext.js';
import { NavigationLayout } from '../../model/ui-config.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { AppLayout } from './AppLayout.js';

const original = window.matchMedia;

function renderLayout(layout: NavigationLayout, mobile: boolean, storage = createMemoryStorage()) {
    window.matchMedia = ((query: string) => ({
        matches: query.includes('max-width') ? mobile : false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    return render(
        <UiConfigContext.Provider value={{ navigation: { layout, showNamespaces: true, showControlDomains: true } }}>
            <MemoryRouter>
                <AppLayout storage={storage}>
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
        const view = renderLayout('sidebar', false, storage);
        const user = userEvent.setup();
        screen.getByRole('button', { name: 'Collapse navigation' }).focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus();
        expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.getByText('Page')).toBeVisible();
        view.unmount();
        renderLayout('sidebar', false, storage);
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
        renderLayout('sidebar', false, storage);
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
