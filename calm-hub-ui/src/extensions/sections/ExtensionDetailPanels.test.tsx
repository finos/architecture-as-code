import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsContext } from '../ExtensionsContext.js';
import type { ExtensionSummary } from '../../model/extensions.js';
import { ExtensionService } from '../../service/extension-service.js';
import { createMemoryStorage } from '../../test-support/memory-storage.js';
import { fakeExtensions } from '../../test-support/fake-extensions.js';
import { DETAIL_PANEL_SECTIONS_KEY, ExtensionDetailPanels } from './ExtensionDetailPanels.js';

const context = { namespace: 'demo', resource: 'architectures/1', version: '1.0.0', selectedElement: 'web-app' };

function renderPanels(extensions: ExtensionSummary[], storage: Storage) {
    return render(
        <ExtensionsContext.Provider value={extensions}>
            <ExtensionDetailPanels context={context} storage={storage} />
        </ExtensionsContext.Provider>
    );
}

afterEach(() => vi.restoreAllMocks());

describe('ExtensionDetailPanels', () => {
    it('shows one Extensions section with the first of ten panels open', async () => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        renderPanels(fakeExtensions(10), createMemoryStorage());

        expect(screen.getAllByRole('heading', { name: 'Extensions' })).toHaveLength(1);
        const toggles = screen.getAllByRole('button', { expanded: false });
        expect(toggles).toHaveLength(9);
        expect(screen.getByRole('button', { name: /^Extension 1$/, expanded: true })).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'detail-panel 1' })).toBeInTheDocument();
        expect(call).toHaveBeenCalledTimes(1);
        expect(call.mock.calls[0][2]).toEqual(context);
    });

    it('remembers the open state per extension', async () => {
        vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        const storage = createMemoryStorage();
        const view = renderPanels(fakeExtensions(10), storage);
        await userEvent.click(screen.getByRole('button', { name: /^Extension 4$/ }));
        view.unmount();

        renderPanels(fakeExtensions(10), storage);
        expect(screen.getByRole('button', { name: /^Extension 4$/ })).toHaveAttribute('aria-expanded', 'true');
        expect(JSON.parse(storage.getItem(DETAIL_PANEL_SECTIONS_KEY)!)).toEqual({ 'ext-4': true });
    });

    it('shows nothing without a detail panel', () => {
        const { container } = renderPanels(fakeExtensions(2, ['screen']), createMemoryStorage());
        expect(container).toBeEmptyDOMElement();
    });
});

it('puts each extension and its panel title below the h4 of the Extensions section', async () => {
    vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    renderPanels(fakeExtensions(1), createMemoryStorage());
    expect(screen.getByRole('heading', { name: 'Extensions', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Extension 1', level: 5 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'detail-panel 1', level: 6 })).toBeInTheDocument();
});
