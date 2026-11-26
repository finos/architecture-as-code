import { describe, expect, it } from 'vitest';
import {
    actionContributions,
    extensionNavLinks,
    resourceExtensions,
    screenPath,
    selectionActions,
    slotContributions,
    TAB_PATH_PARAMETERS,
} from './contributions.js';
import DESIGNER_TAB_PARAMS from '../../../calm-hub/src/test/resources/extensions-test/designer-tab-params.json' with { type: 'json' };
import { fakeExtension, withScreens } from '../test-support/fake-extensions.js';

describe('extensionNavLinks', () => {
    const assurance = withScreens(fakeExtension(1, ['landing-card']), ['Reviews', 'Exceptions', 'Archive']);
    const chat = { extension: 'ext-1', contribution: { id: 'ask', title: 'Ask Atlas' } };

    it('lists the screens in manifest order', () => {
        expect(extensionNavLinks(assurance)).toEqual([
            { key: 'screen/reviews', title: 'Reviews', to: '/extensions/ext-1/reviews' },
            { key: 'screen/exceptions', title: 'Exceptions', to: '/extensions/ext-1/exceptions' },
            { key: 'screen/archive', title: 'Archive', to: '/extensions/ext-1/archive' },
        ]);
    });

    it('has no link for an extension without a screen', () => {
        expect(extensionNavLinks(fakeExtension(2, ['landing-card', 'detail-panel']))).toEqual([]);
    });

    it('puts the chat after the screens of the selected chat provider only', () => {
        expect(extensionNavLinks(assurance, chat).map(({ title, to }) => [title, to])).toEqual([
            ['Reviews', '/extensions/ext-1/reviews'],
            ['Exceptions', '/extensions/ext-1/exceptions'],
            ['Archive', '/extensions/ext-1/archive'],
            ['Ask Atlas', '/chat'],
        ]);
        expect(extensionNavLinks(fakeExtension(2), chat).map(({ to }) => to)).toEqual(['/extensions/ext-2/screen']);
    });

    it('gives a chat provider with no screen its chat link', () => {
        const knowledge = fakeExtension(3, ['landing-card']);
        expect(extensionNavLinks(knowledge, { ...chat, extension: 'ext-3' })).toEqual([{ key: 'chat/ask', title: 'Ask Atlas', to: '/chat' }]);
    });
});

describe('extension contributions', () => {
    it('shows an action only when the context gives its path parameters', () => {
        const extension = fakeExtension(1);
        const scoped = { ...extension, routes: extension.routes.map((r) => (r.id === 'run' ? { ...r, path: '/run/{namespace}/{selectedElement}' } : r)) };
        expect(actionContributions(scoped, {})).toEqual([]);
        expect(actionContributions(scoped, { namespace: 'ns', selectedElement: 'node' })).toHaveLength(1);
        expect(actionContributions(scoped, { namespace: 'ns', selectedElement: 'a/b' })).toEqual([]);
    });

    it('drops an action whose route is missing', () => {
        const extension = { ...fakeExtension(1), routes: [] };
        expect(actionContributions(extension, {})).toEqual([]);
    });

    it('lists the extensions with an action, a designer tab or a detail panel for the resource, and not a screen', () => {
        const entries = resourceExtensions(
            [fakeExtension(1, ['designer-tab']), fakeExtension(2, ['action']), fakeExtension(3, ['screen', 'detail-panel']), fakeExtension(4, ['screen'])],
            { namespace: 'ns' }
        );
        expect(entries.map(({ extension, actions, tabs, panels }) => [extension.id, actions.length, tabs.length, panels.length])).toEqual([
            ['ext-1', 0, 1, 0],
            ['ext-2', 1, 0, 0],
            ['ext-3', 0, 0, 1],
        ]);
    });

    it('hides a designer tab whose path needs a parameter that no context gives', () => {
        const extension = fakeExtension(1, ['designer-tab']);
        const unfillable = { ...extension, routes: extension.routes.map((r) => (r.id === 'data' ? { ...r, path: '/data/{resource}' } : r)) };
        expect(resourceExtensions([unfillable], { namespace: 'ns' })).toEqual([]);
    });

    it('gives the designer tab parameters that Hub accepts', () => {
        expect([...TAB_PATH_PARAMETERS]).toEqual(DESIGNER_TAB_PARAMS);
    });

    it('keeps a designer tab that needs a selected element waiting until one is selected', () => {
        const extension = fakeExtension(1, ['designer-tab']);
        const perNode = { ...extension, routes: extension.routes.map((r) => (r.id === 'data' ? { ...r, path: '/nodes/{selectedElement}/health' } : r)) };
        const [waiting] = resourceExtensions([perNode], { namespace: 'ns' });
        expect(waiting.tabs).toEqual([]);
        expect(waiting.tabsNeedSelection.map((c) => c.id)).toEqual(['designer-tab']);
        const [selected] = resourceExtensions([perNode], { namespace: 'ns', selectedElement: 'web-app' });
        expect(selected.tabs.map((c) => c.id)).toEqual(['designer-tab']);
        expect(selected.tabsNeedSelection).toEqual([]);
    });

    it('hides an action when a context value has a control character', () => {
        const extension = fakeExtension(1, ['action']);
        expect(actionContributions(extension, { namespace: 'ns\n' })).toEqual([]);
        expect(actionContributions(extension, { namespace: 'ns\u007f' })).toEqual([]);
    });

    it('keeps an extension whose only action waits for a selected element, and moves the action when one is selected', () => {
        const extension = fakeExtension(1, ['action']);
        const scoped = { ...extension, routes: extension.routes.map((r) => (r.id === 'run' ? { ...r, path: '/scan/{selectedElement}' } : r)) };
        const [waiting] = resourceExtensions([scoped], { namespace: 'ns' });
        expect([waiting.actions.length, waiting.needsSelection.map((c) => c.id)]).toEqual([0, ['run']]);
        const [selected] = resourceExtensions([scoped], { namespace: 'ns', selectedElement: 'node' });
        expect([selected.actions.map((c) => c.id), selected.needsSelection.length]).toEqual([['run'], 0]);
        expect(selectionActions(scoped, { selectedElement: 'a/b' }).map((c) => c.id)).toEqual(['run']);
    });

    it('does not keep an action that a selection cannot fill', () => {
        const extension = fakeExtension(1, ['action']);
        const scoped = { ...extension, routes: extension.routes.map((r) => (r.id === 'run' ? { ...r, path: '/scan/{version}' } : r)) };
        expect(resourceExtensions([scoped], {})).toEqual([]);
    });

    it('keeps a detail panel the context can fill and one without its route, and drops one it cannot fill', () => {
        const extension = {
            ...fakeExtension(1),
            routes: [{ id: 'element', method: 'GET' as const, path: '/elements/{selectedElement}', scope: 'authenticated', readOnly: true }],
            contributes: {
                'detail-panel': [
                    { id: 'element', title: 'Element', route: 'element' },
                    { id: 'missing', title: 'Missing', route: 'gone' },
                ],
            },
        };
        expect(slotContributions(extension, 'detail-panel', { selectedElement: 'web-app' }).map((c) => c.id)).toEqual(['element', 'missing']);
        expect(slotContributions(extension, 'detail-panel', {}).map((c) => c.id)).toEqual(['missing']);
        expect(slotContributions(extension, 'detail-panel', { selectedElement: 'a/b' }).map((c) => c.id)).toEqual(['missing']);
    });

    it('builds an encoded screen path', () => {
        const extension = { ...fakeExtension(1), id: 'a b' };
        expect(screenPath(extension, { id: 'x/y', title: 'X', route: 'data' })).toBe('/extensions/a%20b/x%2Fy');
    });
});
