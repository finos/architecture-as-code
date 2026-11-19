// Run with: node --test calm-hub/local-dev/extensions/example-services/server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startBackend } from '../../demo-extensions/backend-harness.mjs';

const manifest = JSON.parse(readFileSync(new URL('./extension.json', import.meta.url), 'utf8'));

test('refuses a POST that is not JSON, also with no body or no Content-Type', async (t) => {
    const backend = await startBackend(new URL('./server.mjs', import.meta.url), 'example-services');
    t.after(backend.stop);
    const body = '{"hubApi":0,"query":"settlement","limit":10}';

    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
        assert.equal((await backend.request('POST', '/search', body, { 'Content-Type': type })).status, 415, type);
        assert.equal((await backend.request('POST', '/search', undefined, { 'Content-Type': type })).status, 415, type);
    }
    const untyped = await backend.request('POST', '/search', Buffer.from(body), { 'Content-Type': undefined });
    assert.equal(untyped.status, 415);

    const json = await backend.request('POST', '/search', body);
    assert.equal(json.status, 200);
    assert.deepEqual((await json.json()).results.map((r) => r.id), ['finos/settlement-engine', 'finos/settlement-reports']);
});

const settlement = {
    id: 'finos/settlement-engine', title: 'settlement-engine', summary: 'A service that alice owns', namespace: 'finos',
    link: { screen: { extension: 'example-services', screen: 'services' } },
};

test('search returns only the services that the caller owns, in the search-provider reply', async (t) => {
    const backend = await startBackend(new URL('./server.mjs', import.meta.url), 'example-services');
    t.after(backend.stop);

    const all = await backend.request('POST', '/search', '{"hubApi":0,"query":"engine","limit":10}');
    assert.equal(all.status, 200);
    assert.deepEqual(await all.json(), { hubApi: 0, results: [settlement] });
    const other = await backend.request('POST', '/search', '{"hubApi":0,"query":"refunds","limit":10}');
    assert.deepEqual(await other.json(), { hubApi: 0, results: [] });
});

test('search pages with the cursor, and reads a cursor that is not a number as the first page', async (t) => {
    const backend = await startBackend(new URL('./server.mjs', import.meta.url), 'example-services');
    t.after(backend.stop);
    const first = await (await backend.request('POST', '/search', '{"hubApi":0,"query":"settlement","limit":1}')).json();
    assert.deepEqual(first.results.map((r) => r.id), ['finos/settlement-engine']);
    assert.equal(first.next, '1');
    const second = await (await backend.request('POST', '/search',
        JSON.stringify({ hubApi: 0, query: 'settlement', limit: 1, cursor: first.next }))).json();
    assert.deepEqual(second.results.map((r) => r.id), ['finos/settlement-reports']);
    assert.equal(second.next, undefined);
    const forged = await (await backend.request('POST', '/search', '{"hubApi":0,"query":"settlement","limit":1,"cursor":"x"}')).json();
    assert.deepEqual(forged.results.map((r) => r.id), ['finos/settlement-engine']);
});

test('every GET route that returns blocks is readOnly', () => {
    const routes = new Map(manifest.routes.map((r) => [r.id, r]));
    for (const { route } of manifest.contributes.screen) {
        assert.equal(routes.get(route).method, 'GET', route);
        assert.equal(routes.get(route).readOnly, true, route);
    }
});
