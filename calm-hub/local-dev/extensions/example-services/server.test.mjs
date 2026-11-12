// Run with: node --test calm-hub/local-dev/extensions/example-services/server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startBackend } from '../../demo-extensions/backend-harness.mjs';

const manifest = JSON.parse(readFileSync(new URL('./extension.json', import.meta.url), 'utf8'));

test('refuses a POST that is not JSON, also with no body or no Content-Type', async (t) => {
    const backend = await startBackend(new URL('./server.mjs', import.meta.url), 'example-services');
    t.after(backend.stop);
    const body = '{"q":"settlement"}';

    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
        assert.equal((await backend.request('POST', '/search', body, { 'Content-Type': type })).status, 415, type);
        assert.equal((await backend.request('POST', '/search', undefined, { 'Content-Type': type })).status, 415, type);
    }
    const untyped = await backend.request('POST', '/search', Buffer.from(body), { 'Content-Type': undefined });
    assert.equal(untyped.status, 415);

    const json = await backend.request('POST', '/search', body);
    assert.equal(json.status, 200);
    assert.deepEqual(await json.json(), { results: [{ namespace: 'finos', name: 'settlement-engine' }] });
});

test('every GET route that returns blocks is readOnly', () => {
    const routes = new Map(manifest.routes.map((r) => [r.id, r]));
    for (const { route } of manifest.contributes.screen) {
        assert.equal(routes.get(route).method, 'GET', route);
        assert.equal(routes.get(route).readOnly, true, route);
    }
});
