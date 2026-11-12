import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionsContext } from './ExtensionsContext.js';
import { ExtensionPoints, ExtensionScreenLinks } from './ExtensionPoints.js';
import { extensionTabs } from './extension-tabs.js';
import { ExtensionSummary } from '../model/extensions.js';
import { ExtensionService } from '../service/extension-service.js';

const extension: ExtensionSummary = {
    id: 'test',
    name: 'Test',
    hubApi: 0,
    routes: [{ id: 'data', path: '/data', method: 'GET', scope: 'authenticated', readOnly: true }],
    contributes: Object.fromEntries(
        ['screen', 'landing-card', 'designer-tab', 'detail-panel', 'action'].map((key) => [
            key,
            [{ id: 'summary', title: 'Summary', route: 'data' }],
        ])
    ),
};
afterEach(() => vi.restoreAllMocks());

describe('extension points', () => {
    it('renders nothing without extensions', () => {
        const { container } = render(
            <MemoryRouter>
                <ExtensionScreenLinks />
                <ExtensionPoints point="landing-card" placement="test" />
            </MemoryRouter>
        );
        expect(container).toBeEmptyDOMElement();
        expect(extensionTabs([])).toEqual([]);
    });

    it('links to a screen route', () => {
        render(
            <MemoryRouter>
                <ExtensionsContext.Provider value={[extension]}>
                    <ExtensionScreenLinks />
                </ExtensionsContext.Provider>
            </MemoryRouter>
        );
        expect(screen.getByRole('link', { name: 'Summary' })).toHaveAttribute('href', '/extensions/test/summary');
    });

    it.each(['landing-card', 'detail-panel'] as const)('loads a %s slot with context', async (point) => {
        const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
        render(
            <ExtensionsContext.Provider value={[extension]}>
                <ExtensionPoints point={point} context={{ namespace: 'test', selectedElement: 'node' }} placement="test" />
            </ExtensionsContext.Provider>
        );
        expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument();
        expect(call.mock.calls[0][2]).toMatchObject({ namespace: 'test', selectedElement: 'node' });
    });

    it('registers a designer tab with a stable namespaced id', () => {
        expect(extensionTabs([extension])[0]).toMatchObject({ id: 'extension:test:summary', label: 'Summary' });
    });
});

it('shows actions only when their route context is available', () => {
    const scoped = { ...extension, routes: [{ ...extension.routes[0], path: '/data/{namespace}/{selectedElement}' }] };
    const view = render(
        <ExtensionsContext.Provider value={[scoped]}>
            <ExtensionPoints point="action" placement="test" />
        </ExtensionsContext.Provider>
    );
    expect(screen.queryByRole('button')).toBeNull();
    view.rerender(
        <ExtensionsContext.Provider value={[scoped]}>
            <ExtensionPoints point="action" context={{ namespace: 'test', selectedElement: 'node' }} placement="test" />
        </ExtensionsContext.Provider>
    );
    expect(screen.getByRole('button', { name: 'Summary' })).toBeInTheDocument();
});

it('passes the resource and selected element from a registered designer tab', async () => {
    const call = vi.spyOn(ExtensionService.prototype, 'call').mockResolvedValue({ hubApi: 0, blocks: [] });
    const tab = extensionTabs([extension])[0];
    render(
        tab.render({
            data: { name: 'test', id: '1', version: '1.0.0', calmType: 'Architectures', data: { nodes: [], relationships: [] } },
            selectedElement: 'node',
        } as Parameters<typeof tab.render>[0])
    );
    expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument();
    expect(call.mock.calls[0][2]).toMatchObject({
        namespace: 'test', resource: 'architectures/1', resourceType: 'architectures', resourceId: '1', version: '1.0.0', selectedElement: 'node',
    });
});
