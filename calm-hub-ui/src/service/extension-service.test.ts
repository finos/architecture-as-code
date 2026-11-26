import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatCallError, ExtensionService, extensionRequest, formOutcome, MAX_REQUEST_LINE, readEventStream } from './extension-service.js';
import { ExtensionRoute } from '../model/extensions.js';
import { migrationStore } from './utils/migration-store.js';
import { authStore } from './utils/auth-store.js';
import { apiClient } from './utils/api-client.js';
import { getAuthHeaders } from '../authService.js';
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
        expect(await service.fetchDecoratorViews()).toEqual([]);
    });
    it('rejects registry failures', async () => {
        mock.onGet('/api/calm/extensions').reply(500);
        await expect(new ExtensionService(ax).fetchExtensions()).rejects.toThrow('Error fetching extensions');
    });
    it('keeps registry and contribution order, including views without routes', async () => {
        const first = { id: 'scanner', match: { type: 'scan' }, label: 'Scan' };
        const second = { id: 'audit', match: { schema: 'https://example.org/audit' }, label: 'Audit' };
        mock.onGet('/api/calm/extensions').reply(200, { values: [
            entry('a', views(first, second)), entry('b'), entry('c', views(second)),
        ] });
        expect(await new ExtensionService(ax).fetchDecoratorViews()).toMatchObject([first, second, second]);
        expect(mock.history.get[0].headers?.Authorization).toBe('test');
    });
    it('tags each decorator view with its extension, and marks built-in ones', async () => {
        const view = { id: 'risk', match: { type: 'risk' }, label: 'Risk' };
        mock.onGet('/api/calm/extensions').reply(200, { values: [
            entry('release-tracker', { name: 'Release tracker', ...views(view) }),
            entry('deployment', { name: 'Deployments', ...views(view) }),
            entry('nameless', views(view)),
        ] });
        expect((await new ExtensionService(ax).fetchDecoratorViews()).map((v) => v.source)).toEqual([
            { id: 'release-tracker', name: 'Release tracker', builtIn: false },
            { id: 'deployment', name: 'Deployments', builtIn: true },
            { id: 'nameless', name: 'nameless', builtIn: false },
        ]);
        expect(mock.history.get[0].headers?.Authorization).toBe('test');
    });
    it('rejects a failed decorator view request', async () => {
        mock.onGet('/api/calm/extensions').reply(503);
        await expect(new ExtensionService(ax).fetchDecoratorViews()).rejects.toThrow('Error fetching decorator views:');
    });
    it('shares one registry request between extensions and decorator views', async () => {
        mock.onGet('/api/calm/extensions').reply(200, { values: [entry('test')] });
        const service = new ExtensionService(ax);
        await Promise.all([service.fetchExtensions(), service.fetchDecoratorViews(), service.fetchExtensions()]);
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
    it('keeps the title and detail of a problem reply', async () => {
        mock.onGet().reply(422, { type: 'about:blank', title: 'No C4 mapping', detail: 'Add one to the namespace', status: 422 });
        await expect(new ExtensionService(ax).call('test', route, { namespace: 'ns' }))
            .rejects.toMatchObject({ problem: { title: 'No C4 mapping', detail: 'Add one to the namespace' } });
    });
    it('shows the error message of a refusal by Hub', async () => {
        mock.onGet().reply(413, { error: 'The document is too large for this extension' });
        await expect(new ExtensionService(ax).call('test', route, { namespace: 'ns' }))
            .rejects.toMatchObject({ problem: { title: 'The document is too large for this extension' } });
    });
    it('reads the notation of a lens, and the core notation once', async () => {
        mock.onGet('/api/calm/extensions/c%204/lenses/a%2Fb/notation').reply(200, { shapes: {} });
        mock.onGet('/api/calm/extensions/notations/core').replyOnce(200, { markers: {} });
        const service = new ExtensionService(ax);
        expect(await service.fetchLensNotation('c 4', 'a/b')).toEqual({ shapes: {} });
        expect(await service.fetchCoreNotation()).toEqual({ markers: {} });
        expect(await service.fetchCoreNotation()).toEqual({ markers: {} });
    });
    it('keeps registry and proxy failures out of the global error pages', async () => {
        const shared = new AxiosMockAdapter(apiClient as never);
        shared.onAny().reply(401);
        mock.onGet('/api/calm/extensions').reply(503);
        mock.onGet().reply(401);
        const service = new ExtensionService();
        await expect(service.fetchDecoratorViews()).rejects.toThrow();
        await expect(service.fetchExtensions()).rejects.toThrow();
        await expect(service.call('test', route, { namespace: 'ns' })).rejects.toThrow();
        await expect(service.search('test', 'records', 'q')).rejects.toThrow();
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
    it('drops registry entries of an unsupported contract from extensions and decorator views alike', async () => {
        const view = { id: 'risk', match: { type: 'risk' }, label: 'Risk' };
        mock.onGet('/api/calm/extensions').reply(200, { values: [
            entry('now', views(view)),
            entry('future', { hubApi: 1, ...views({ ...view, id: 'future-risk' }) }),
            null,
        ] });
        const service = new ExtensionService(ax);
        expect((await service.fetchExtensions()).map((e) => e.id)).toEqual(['now']);
        expect((await service.fetchDecoratorViews()).map((v) => v.id)).toEqual(['risk']);
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
            entry('good-lens', { contributes: { 'diagram-lens': [{ id: 'l', title: 'L', route: 'r', notation: 'n.json', params: {} }] } }),
            entry('lens-no-notation', { contributes: { 'diagram-lens': [{ id: 'l', title: 'L', route: 'r' }] } }),
            entry('lens-list-params', { contributes: { 'diagram-lens': [{ id: 'l', title: 'L', route: 'r', notation: 'n.json', params: [] }] } }),
            entry('good-search', { contributes: { 'search-provider': [{ id: 's', title: 'S', route: 'r' }] } }),
            entry('search-no-title', { contributes: { 'search-provider': [{ id: 's', route: 'r' }] } }),
        ] });
        const service = new ExtensionService(ax);
        expect((await service.fetchExtensions()).map((e) => e.id)).toEqual(['good', 'good-views', 'good-screen', 'good-lens', 'good-search']);
        expect((await service.fetchDecoratorViews()).map((v) => v.id)).toEqual(['risk']);
    });
    it('keeps a logo, and drops only a malformed logo, not its extension', async () => {
        mock.onGet('/api/calm/extensions').reply(200, {
            values: [
                entry('both', { logo: { light: 'logo.svg', dark: 'logo-dark.png' } }),
                entry('light', { logo: { light: 'logo.svg' } }),
                entry('no-light', { logo: { dark: 'logo.svg' } }),
                entry('bad-dark', { logo: { light: 'logo.svg', dark: 7 } }),
                entry('not-object', { logo: 'https://images.example.com/logo.svg' }),
            ],
        });
        const extensions = await new ExtensionService(ax).fetchExtensions();
        expect(extensions.map((e) => [e.id, e.logo])).toEqual([
            ['both', { light: 'logo.svg', dark: 'logo-dark.png' }],
            ['light', { light: 'logo.svg' }],
            ['no-light', undefined],
            ['bad-dark', undefined],
            ['not-object', undefined],
        ]);
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
    it('skips a decorator-views value that is not a list, and keeps the other views', async () => {
        mock.onGet('/api/calm/extensions').reply(200, { values: [
            entry('object', { contributes: { 'decorator-views': { id: 'risk' } } }),
            entry('text', { contributes: { 'decorator-views': 'risk' } }),
            entry('null', { contributes: { 'decorator-views': null } }),
            entry('good', views({ id: 'audit' })),
        ] });
        expect((await new ExtensionService(ax).fetchDecoratorViews()).map((v) => v.id)).toEqual(['audit']);
    });
    it('searches with a provider through its Hub endpoint, with the query and the cursor', async () => {
        const page = { results: [{ id: 'a', title: 'Payments', summary: 'S', namespace: 'finos', link: { href: 'https://example.org' } }], next: 'p2' };
        mock.onGet('/api/calm/extensions/release%2Ftracker/search/records').reply(200, page);
        expect(await new ExtensionService(ax).search('release/tracker', 'records', 'pay ments', 'p1')).toEqual(page);
        expect(mock.history.get[0].params).toEqual({ q: 'pay ments', cursor: 'p1' });
        expect(mock.history.get[0].headers?.Authorization).toBe('test');

        mock.resetHistory();
        await new ExtensionService(ax).search('release/tracker', 'records', 'pay');
        expect(mock.history.get[0].params).toEqual({ q: 'pay' });
    });
    it.each([
        ['a reply with no results list', { next: 'x' }],
        ['a result with no title', { results: [{ id: 'a' }] }],
        ['a result that is not an object', { results: ['a'] }],
        ['a link that is not an object', { results: [{ id: 'a', title: 'T', link: 'https://example.org' }] }],
        ['a cursor that is not text', { results: [], next: 2 }],
    ])('rejects %s', async (_name, reply) => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mock.onGet('/api/calm/extensions/x/search/y').reply(200, reply);
        await expect(new ExtensionService(ax).search('x', 'y', 'q')).rejects.toMatchObject({ timedOut: false });
    });
    it('reports a search that timed out apart from one that failed', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mock.onGet('/api/calm/extensions/x/search/y').replyOnce(504, { error: 'The extension did not reply in time' });
        await expect(new ExtensionService(ax).search('x', 'y', 'q')).rejects.toMatchObject({ timedOut: true });
        mock.onGet('/api/calm/extensions/x/search/y').replyOnce(502, { error: 'The search provider failed' });
        await expect(new ExtensionService(ax).search('x', 'y', 'q')).rejects.toMatchObject({ timedOut: false });
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
    it('measures the request line as the browser sends it, with the path, the query and its own encoding', () => {
        const service = new ExtensionService(ax);
        // `GET /api/calm/extensions/test/api/summary/ns?namespace=ns&q=<q> HTTP/1.1`
        const room = MAX_REQUEST_LINE - 'GET /api/calm/extensions/test/api/summary/ns?namespace=ns&q= HTTP/1.1'.length;
        const fits = (q: string) => service.fitsRequestLine('test', route, { namespace: 'ns', q });
        expect(fits('a'.repeat(room))).toBe(true);
        expect(fits('a'.repeat(room + 1))).toBe(false);
        // axios leaves ' as it is, and the browser sends it as %27.
        expect(fits(`${'a'.repeat(room - 3)}'`)).toBe(true);
        expect(fits(`${'a'.repeat(room - 1)}'`)).toBe(false);
        // A call that is not valid fits here, and `call` refuses it.
        expect(service.fitsRequestLine('test', route, {})).toBe(true);
    });
});

describe('form submissions', () => {
    const body = { submission: '0b0e7c1e-6a1d-4a43-9d6c-2b0a8f8d1a10', context: { namespace: 'finos' }, input: { note: 'a' } };
    const sent = { 'calm-extension-dispatch': 'sent' };
    const notSent = { 'calm-extension-dispatch': 'not-sent' };

    it.each([
        ['a 2xx', 201, sent, { message: 'Review 12 opened.' }, { kind: 'success', message: 'Review 12 opened.' }],
        ['Hub busy before it sent the call', 503, notSent, { error: 'The extension is busy' }, { kind: 'failed', sent: false, message: 'The extension is busy' }],
        // A backend can copy the body of a Hub refusal. Only the header, which Hub sets, says that Hub did not send it.
        ['a backend 503 with the body of a Hub refusal', 503, sent, { error: 'The extension is busy' }, { kind: 'unknown' }],
        ['a backend timeout', 504, { 'calm-extension-dispatch': 'unknown' }, { error: 'The extension did not reply in time' }, { kind: 'unknown' }],
        ['a 5xx from a proxy in front of Hub', 502, {}, '<html>Bad gateway</html>', { kind: 'unknown' }],
        // A 4xx without the header did not come through Hub's dispatch, so the backend did not see it.
        ['a 4xx from a proxy in front of Hub', 413, {}, '', { kind: 'failed', sent: false }],
        ['a backend refusal', 409, sent, { title: 'A review is already open', detail: 'Review 11 is open.' }, { kind: 'failed', sent: true, message: 'A review is already open Review 11 is open.' }],
        ['a field error', 422, notSent, { error: 'Check the form', fields: { note: 'Enter a value.', bad: 7 } }, { kind: 'failed', sent: false, message: 'Check the form', fields: { note: 'Enter a value.' } }],
    ])('reads %s', (_name, status, headers, data, outcome) => {
        expect(formOutcome(status, (headers as Record<string, string>)['calm-extension-dispatch'], data)).toEqual(outcome);
    });

    it('posts the submission to the form endpoint of Hub', async () => {
        mock.onPost('/api/calm/extensions/release%20tracker/forms/request-review').reply(201, { message: 'Done' }, sent);
        expect(await new ExtensionService(ax).submitForm('release tracker', 'request-review', body)).toEqual({ kind: 'success', message: 'Done' });
        expect(JSON.parse(mock.history.post[0].data)).toEqual(body);
    });

    it('reports an unknown outcome when no reply comes back', async () => {
        mock.onPost('/api/calm/extensions/test/forms/f').networkError();
        expect(await new ExtensionService(ax).submitForm('test', 'f', body)).toEqual({ kind: 'unknown' });
        mock.onPost('/api/calm/extensions/test/forms/f').timeout();
        expect(await new ExtensionService(ax).submitForm('test', 'f', body)).toEqual({ kind: 'unknown' });
    });

    it('does not send a submission that it cannot sign', async () => {
        vi.mocked(getAuthHeaders).mockRejectedValueOnce(new Error('expired'));
        expect(await new ExtensionService(ax).submitForm('test', 'f', body)).toEqual({
            kind: 'failed',
            sent: false,
            message: 'Sign in again, then send the form.',
        });
        expect(mock.history.post).toHaveLength(0);
    });

    it('does not open the global sign-in or outage page', async () => {
        mock.onPost('/api/calm/extensions/test/forms/f').reply(503, 'Down for maintenance', notSent);
        const migration = vi.spyOn(migrationStore, 'setMigrationError');
        const auth = vi.spyOn(authStore, 'setAuthError');
        expect(await new ExtensionService(ax).submitForm('test', 'f', body)).toEqual({ kind: 'failed', sent: false });
        expect(migration).not.toHaveBeenCalled();
        expect(auth).not.toHaveBeenCalled();
    });
});

describe('ExtensionService chat', () => {
    const chat = { extension: 'knowledge', contribution: 'atlas' };
    it('reads the chat that the operator chose from the one registry request', async () => {
        mock.onGet('/api/calm/extensions').reply(200, { values: [entry('knowledge')], chat });
        const service = new ExtensionService(ax);
        expect(await service.fetchChatProvider()).toBeUndefined();
        await service.fetchExtensions();
        expect(await service.fetchChatProvider()).toEqual(chat);
        expect(mock.history.get).toHaveLength(1);
    });
    it.each([{ extension: 'knowledge' }, 'knowledge', { extension: 1, contribution: 'atlas' }])('ignores a chat value that is not an entry: %j', async (value) => {
        mock.onGet('/api/calm/extensions').reply(200, { values: [entry('knowledge')], chat: value });
        const service = new ExtensionService(ax);
        await service.fetchExtensions();
        expect(await service.fetchChatProvider()).toBeUndefined();
    });
    it('refuses a successful reply that is not an event stream', async () => {
        const fetchFn = vi.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const sent = new ExtensionService(ax, fetchFn).sendChatMessage('knowledge', 'atlas', { conversationId: 'c', messageId: 'm', messages: [] }, vi.fn());
        await expect(sent).rejects.toEqual(new ChatCallError('The chat provider sent a reply that CALM Hub cannot show', 200));
    });
    it.each([
        [{ error: 'The chat message needs 1 to 100 messages' }, 'The chat message needs 1 to 100 messages'],
        [{ message: 'Slow down' }, 'Slow down'],
        [{ title: 'Too many questions', detail: 'Wait a minute' }, 'Wait a minute'],
    ])('shows the message of a refusal %j', async (body, message) => {
        const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 429, headers: { 'Content-Type': 'application/json' } }));
        const sent = new ExtensionService(ax, fetchFn).sendChatMessage('knowledge', 'atlas', { conversationId: 'c', messageId: 'm', messages: [] }, vi.fn());
        await expect(sent).rejects.toEqual(new ChatCallError(message, 429));
    });
    it('names a network failure', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
        const sent = new ExtensionService(ax, fetchFn).sendChatMessage('knowledge', 'atlas', { conversationId: 'c', messageId: 'm', messages: [] }, vi.fn());
        await expect(sent).rejects.toThrow('CALM Hub could not be reached');
    });
});

describe('readEventStream', () => {
    const streamOf = (...chunks: string[]) =>
        new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
                controller.close();
            },
        });
    const read = async (...chunks: string[]) => {
        const events: { name: string; data: string }[] = [];
        await readEventStream(streamOf(...chunks), (event) => events.push(event));
        return events;
    };

    it('joins data lines, names an unnamed event message, and skips comments', async () => {
        expect(await read(': heartbeat\n\nevent: delta\ndata: {"text":\ndata: "a"}\n\ndata: plain\n\n')).toEqual([
            { name: 'delta', data: '{"text":\n"a"}' },
            { name: 'message', data: 'plain' },
        ]);
    });
    it('reads an event that a chunk splits, also between CR and LF and inside a character', async () => {
        const bytes = new TextEncoder().encode('event: delta\r\ndata: {"text":"\u00e9"}\r\n\r\n');
        const at = bytes.indexOf(0xa9);
        const events: { name: string; data: string }[] = [];
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(bytes.slice(0, 13));
                controller.enqueue(bytes.slice(13, at));
                controller.enqueue(bytes.slice(at));
                controller.close();
            },
        });
        await readEventStream(stream, (event) => events.push(event));
        expect(events).toEqual([{ name: 'delta', data: '{"text":"\u00e9"}' }]);
    });
    it('drops a last event with no blank line after it', async () => {
        expect(await read('event: done\ndata: {}\n\nevent: delta\ndata: {"text":"cut"}')).toEqual([{ name: 'done', data: '{}' }]);
    });
});
