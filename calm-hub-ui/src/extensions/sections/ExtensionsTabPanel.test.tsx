import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsContext } from '../ExtensionsContext.js';
import type { ExtensionSummary } from '../../model/extensions.js';
import { ExtensionService } from '../../service/extension-service.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { fakeExtensions } from '../../test-support/fake-extensions.js';
import { ExtensionsTabPanel } from './ExtensionsTabPanel.js';

const context = { namespace: 'demo', resource: 'architectures/1', version: '1.0.0', selectedElement: 'web-app' };

function renderPanel(extensions: ExtensionSummary[], storage = createMemoryStorage()) {
    return render(
        <ExtensionsContext.Provider value={extensions}>
            <ExtensionsTabPanel context={context} storage={storage} />
        </ExtensionsContext.Provider>
    );
}

afterEach(() => vi.restoreAllMocks());

describe('ExtensionsTabPanel', () => {
    it('shows actions above the designer tab of the open extension, and loads only that tab', async () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        renderPanel(fakeExtensions(10));

        const sections = screen.getAllByTestId('extension-section');
        expect(sections).toHaveLength(10);
        const first = sections[0];
        const action = within(first).getByRole('button', { name: 'Run 1' });
        const heading = await within(first).findByRole('heading', { name: 'designer-tab 1' });
        expect(action.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(call).toHaveBeenCalledTimes(1);
        expect(call.mock.calls[0][2]).toEqual(context);
        expect(screen.queryByRole('button', { name: 'Run 2' })).not.toBeInTheDocument();
    });

    it('filters ten extensions by name or provider', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        renderPanel(fakeExtensions(10));

        await userEvent.type(screen.getByRole('searchbox', { name: 'Filter extensions' }), 'Provider 10');
        expect(screen.getAllByTestId('extension-section').map((s) => s.dataset.extension)).toEqual(['ext-10']);

        await userEvent.clear(screen.getByRole('searchbox', { name: 'Filter extensions' }));
        await userEvent.type(screen.getByRole('searchbox', { name: 'Filter extensions' }), 'nothing');
        expect(screen.getByText('No extension matches the filter.')).toBeInTheDocument();
    });

    it('offers no filter for a few extensions', () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        renderPanel(fakeExtensions(2));
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('leaves out extensions with neither an action nor a designer tab', () => {
        renderPanel(fakeExtensions(3, ['screen', 'landing-card']));
        expect(screen.queryAllByTestId('extension-section')).toHaveLength(0);
    });
});

describe('ExtensionsTabPanel with an action that needs a selected element', () => {
    const scanner = (() => {
        const extension = fakeExtensions(1, ['action'])[0];
        return { ...extension, routes: extension.routes.map((r) => (r.id === 'run' ? { ...r, path: '/scan/{selectedElement}' } : r)) };
    })();

    it('shows the action disabled with a hint when no element is selected', () => {
        render(
            <ExtensionsContext.Provider value={[scanner]}>
                <ExtensionsTabPanel context={{ namespace: 'demo' }} storage={createMemoryStorage()} />
            </ExtensionsContext.Provider>
        );
        const button = screen.getByRole('button', { name: 'Run 1' });
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAccessibleDescription('Some actions need a selected node. Open this tab from a link that names a node.');
    });

    it('lets a keyboard user reach the disabled action and its hint, and a click runs nothing', () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call');
        render(
            <ExtensionsContext.Provider value={[scanner]}>
                <ExtensionsTabPanel context={{ namespace: 'demo' }} storage={createMemoryStorage()} />
            </ExtensionsContext.Provider>
        );
        const button = screen.getByRole('button', { name: 'Run 1' });
        button.focus();
        expect(button).toHaveFocus();
        button.click();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(call).not.toHaveBeenCalled();
    });

    it('lists the action disabled when the path rule refuses the selected id', () => {
        render(
            <ExtensionsContext.Provider value={[scanner]}>
                <ExtensionsTabPanel context={{ namespace: 'demo', selectedElement: 'a/b' }} storage={createMemoryStorage()} />
            </ExtensionsContext.Provider>
        );
        const button = screen.getByRole('button', { name: 'Run 1' });
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAccessibleDescription('Some actions cannot run for the selected node.');
    });

    it('enables the action when an element is selected', () => {
        renderPanel([scanner]);
        expect(screen.getByRole('button', { name: 'Run 1' })).toBeEnabled();
        expect(screen.queryByText(/need a selected node/)).not.toBeInTheDocument();
    });
});

it('puts each extension at h3 and its designer tab title at h4, below the h2 of the resource', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    renderPanel(fakeExtensions(1));
    expect(screen.getByRole('heading', { name: /Extension 1/, level: 3 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'designer-tab 1', level: 4 })).toBeInTheDocument();
});

it('keeps the default open section of the full list when a filter changes', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    renderPanel(fakeExtensions(10));
    const filter = screen.getByRole('searchbox', { name: 'Filter extensions' });
    const toggle = (id: string) =>
        screen.getAllByTestId('extension-section').find((section) => section.dataset.extension === id)!.querySelector('button');

    await userEvent.type(filter, 'Provider 3');
    expect(toggle('ext-3')).toHaveAttribute('aria-expanded', 'false');

    await userEvent.clear(filter);
    expect(toggle('ext-1')).toHaveAttribute('aria-expanded', 'true');
    expect(toggle('ext-3')).toHaveAttribute('aria-expanded', 'false');

    await userEvent.type(filter, 'Provider 1');
    expect(toggle('ext-1')).toHaveAttribute('aria-expanded', 'true');
});
