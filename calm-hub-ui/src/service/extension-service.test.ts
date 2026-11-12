import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionService, extensionRequest } from './extension-service.js';
import { ExtensionRoute } from '../model/extensions.js';
import { migrationStore } from './utils/migration-store.js';
import { authStore } from './utils/auth-store.js';
import { apiClient } from './utils/api-client.js';
// One list for the clients and Hub: TestExtensionToolsShould checks it against ExtensionPaths.
import PATH_VALUES from '../../../calm-hub/src/test/resources/extensions-test/path-values.json' with { type: 'json' };
vi.mock('../authService.js', () => ({ getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'test' }) }));
const ax = axios.create();
vi.spyOn(axios, 'create').mockReturnValue(ax);
const mock = new AxiosMockAdapter(ax as never);
const route: ExtensionRoute = { id: 'summary', method: 'GET', path: '/summary/{namespace}', scope: 'read', readOnly: true };
afterEach(() => mock.reset());
const entry = (id: string, fields: object = {}) => ({ id, hubApi: 0, routes: [], contributes: {}, ...fields });
const views = (...list: object[]) => ({ contributes: { 'decorator-views': list } });

describe('ExtensionService', () => {
    it('loads the registry', async () => {
        mock.onGet('/api/calm/extensions').reply(200, { values: [entry('test')] });
        expect(await new ExtensionService(ax).fetchExtensions()).toEqual([entry('test')]);
    });
    it('treats an absent registry values list as empty', async () => {
        mock.onGet('/api/calm/extensions').reply(200, {});
        const service = new ExtensionService(ax);
        expect(await service.fetchExtensions()).toEqual([]);
    });
    it('rejects registry failures', async () => {
        mock.onGet('/api/calm/extensions').reply(500);
        await expect(new ExtensionService(ax).fetchExtensions()).rejects.toThrow('Error fetching extensions');
    });
    it('shares one registry request between callers', async () => {
        mock.onGet('/api/calm/extensions').reply(200, { values: [entry('test')] });
        const service = new ExtensionService(ax);
        await Promise.all([service.fetchExtensions(), service.fetchExtensions()]);
        expect(mock.history.get).toHaveLength(1);
    });
    it('retries the registry after a failure', async () => {
        mock.onGet('/api/calm/extensions').replyOnce(500).onGet('/api/calm/extensions').reply(200, { values: [entry('test')] });
        const service = new ExtensionService(ax);
        await expect(service.fetchExtensions()).rejects.toThrow();
        expect(await service.fetchExtensions()).toEqual([entry('test')]);
    });
    it('sends context through the proxy with auth', async () => {
        mock.onGet('/api/calm/extensions/test/api/summary/a%20b').reply((config) => {
            expect(config.params).toEqual({ namespace: 'a b', resource: 'architectures/1', version: '1', selectedElement: 'node' });
            expect(config.headers?.Authorization).toBe('test');
            return [200, { hubApi: 0, blocks: [] }];
        });
        expect(
            await new ExtensionService(ax).call('test', route, { namespace: 'a b', resource: 'architectures/1', version: '1', selectedElement: 'node' })
        ).toEqual({ hubApi: 0, blocks: [] });
    });
    it('sends write context in the body', async () => {
        mock.onPost('/api/calm/extensions/test/api/summary/ns').reply((config) => {
            expect(JSON.parse(config.data)).toEqual({ namespace: 'ns' });
            return [204];
        });
        await new ExtensionService(ax).call('test', { ...route, method: 'POST', readOnly: false }, { namespace: 'ns' });
    });
    it('rejects proxy failures', async () => {
        mock.onGet().reply(502);
        await expect(new ExtensionService(ax).call('test', route, { namespace: 'ns' })).rejects.toThrow();
    });
    it('keeps registry and proxy failures out of the global error pages', async () => {
        const shared = new AxiosMockAdapter(apiClient as never);
        shared.onAny().reply(401);
        mock.onGet('/api/calm/extensions').reply(503);
        mock.onGet().reply(401);
        const service = new ExtensionService();
        await expect(service.fetchExtensions()).rejects.toThrow();
        await expect(service.call('test', route, { namespace: 'ns' })).rejects.toThrow();
        shared.restore();
        expect(migrationStore.getMigrationError()).toBeNull();
        expect(authStore.getAuthError()).toBeNull();
    });
    it('opens the sign-in prompt on a registry 401, which is a Hub call', async () => {
        mock.onGet('/api/calm/extensions').reply(401);
        await expect(new ExtensionService(ax).fetchExtensions()).rejects.toMatchObject({ signedOut: true });
        expect(authStore.getAuthError()).toBe(401);
        authStore.setAuthError(null);
    });
    it('does not mark another registry failure as signed out', async () => {
        mock.onGet('/api/calm/extensions').reply(403);
        await expect(new ExtensionService(ax).fetchExtensions()).rejects.toMatchObject({ signedOut: false });
        expect(authStore.getAuthError()).toBeNull();
    });
    it('drops registry entries of an unsupported contract', async () => {
        const view = { id: 'risk', match: { type: 'risk' }, label: 'Risk' };
        mock.onGet('/api/calm/extensions').reply(200, { values: [
            entry('now', views(view)),
            entry('future', { hubApi: 1, ...views({ ...view, id: 'future-risk' }) }),
            null,
        ] });
        const service = new ExtensionService(ax);
        expect((await service.fetchExtensions()).map((e) => e.id)).toEqual(['now']);
    });
    it('drops a malformed registry entry, so a page does not read a missing field', async () => {
        const route = { id: 'r', method: 'GET', path: '/x', scope: 'read', readOnly: true };
        mock.onGet('/api/calm/extensions').reply(200, { values: [
            entry('good'), entry('good-views', views({ id: 'risk' })),
            entry('good-screen', { routes: [route], contributes: { screen: [{ id: 's', title: 'S', route: 'r' }], future: 'kept' } }),
            { hubApi: 0, routes: [], contributes: {} }, entry('numeric', { id: 7 }),
            entry('no-routes', { routes: undefined }), entry('object-routes', { routes: {} }),
            entry('no-contributes', { contributes: undefined }), entry('list-contributes', { contributes: [] }),
            entry('null-contributes', { contributes: null }), 'scanner', [],
            entry('null-route', { routes: [null] }), entry('route-no-path', { routes: [{ id: 'r', method: 'GET' }] }),
            entry('object-screen', { contributes: { screen: { id: 's' } } }),
            entry('null-action', { contributes: { action: [null] } }),
            entry('tab-no-title', { contributes: { 'designer-tab': [{ id: 't', route: 'r' }] } }),
        ] });
        const service = new ExtensionService(ax);
        expect((await service.fetchExtensions()).map((e) => e.id)).toEqual(['good', 'good-views', 'good-screen']);
    });
    it('logs one warning for each dropped registry entry, with its id if it has one', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mock.onGet('/api/calm/extensions').reply(200, { values: [entry('good'), entry('bad', { routes: {} }), null] });
        expect((await new ExtensionService(ax).fetchExtensions()).map((e) => e.id)).toEqual(['good']);
        expect(warn.mock.calls).toEqual([
            ['%s', 'Dropped extension registry entry: bad'],
            ['%s', 'Dropped an extension registry entry with no id'],
        ]);
        warn.mockRestore();
    });
    it('rejects missing route context', () => {
        expect(() => extensionRequest('test', route, {})).toThrow('Missing extension context');
    });
    // Some JSON parsers refuse a lone surrogate, so the shared list has none.
    it.each([...PATH_VALUES.refused, ...PATH_VALUES.lookAlikes.map((c) => `a${c}b`), '\ud800', 'a\udc00b'])('rejects the invalid path value %j', (value) => {
        expect(() => extensionRequest('test', route, { namespace: value })).toThrow(`Invalid extension context: namespace`);
    });
    it('rejects the delete control character in a path value', () => {
        expect(() => extensionRequest('test', route, { namespace: 'a\u007fb' })).toThrow('Invalid extension context: namespace');
    });
    it.each(PATH_VALUES.accepted)('accepts the path value %j', (value) => {
        expect(extensionRequest('test', route, { namespace: value }).url).toBe(`/api/calm/extensions/test/api/summary/${encodeURIComponent(value)}`);
    });
    it.each(['a\nb', 'a\tb', 'a\u007fb', '\ud800'])('rejects a context value for the query with %j', (value) => {
        expect(() => extensionRequest('test', route, { namespace: 'ns', selectedElement: value })).toThrow('Invalid extension context: selectedElement');
    });
    it('treats a path value with a slash as invalid, and keeps it in the query', () => {
        const typed = { ...route, path: '/releases/{resourceType}/{resourceId}' };
        const context = { resource: 'architectures/1', resourceType: 'architectures', resourceId: '1' };
        expect(extensionRequest('test', typed, context)).toEqual({
            url: '/api/calm/extensions/test/api/releases/architectures/1',
            params: context,
        });
        expect(() => extensionRequest('test', { ...route, path: '/releases/{resource}' }, context)).toThrow('Invalid extension context: resource');
        expect(() => extensionRequest('test', typed, { ...context, resourceId: 'a/b' })).toThrow('Invalid extension context: resourceId');
    });
    it('rejects traversal paths', () => {
        expect(() => extensionRequest('test', { ...route, path: '/../x' }, {})).toThrow('Invalid extension route');
    });
});
