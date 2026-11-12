import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ExtensionsContext } from '../../extensions/ExtensionsContext.js';
import type { ExtensionSummary } from '../../model/extensions.js';
import { fakeExtensions } from '../../test-support/fake-extensions.js';
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

    it('renders nothing without a screen', () => {
        renderGroup(fakeExtensions(2, ['landing-card']));
        expect(screen.queryByText('Extensions')).not.toBeInTheDocument();
    });
});
