// Run with: node --test calm-hub/local-dev/demo-extensions/release-tracker/routes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { route } from './routes.mjs';

const manifest = JSON.parse(readFileSync(new URL('./extension.json', import.meta.url), 'utf8'));
const get = (path) => route('GET', new URL(path, 'http://localhost'), {});

test('the designer tab route takes the resource as two path segments', () => {
    assert.equal(manifest.routes.find((r) => r.id === 'tab').path, '/tab/{resourceType}/{resourceId}');
    assert.ok(manifest.routes.every((r) => !r.path.includes('{resource}')));
});

test('the designer tab names the resource from the path', () => {
    const reply = get('/tab/architectures/trading-system?namespace=demo&resource=architectures%2Ftrading-system&version=1.0.0');

    assert.deepEqual(reply.blocks[0].items.slice(0, 2), [
        { label: 'Resource', value: 'demo / architectures / trading-system' },
        { label: 'Version', value: '1.0.0' },
    ]);
});

test('the designer tab is not found without both path segments', () => {
    assert.equal(get('/tab'), null);
    assert.equal(get('/tab/architectures'), null);
    assert.equal(get('/tab/architectures/1/extra'), null);
});

test('every GET route that a UI contribution names is readOnly', () => {
    const routes = new Map(manifest.routes.map((r) => [r.id, r]));
    const gets = Object.values(manifest.contributes).flat().map((c) => routes.get(c.route)).filter((r) => r?.method === 'GET');
    assert.ok(gets.length >= 4);
    for (const route of gets) assert.equal(route.readOnly, true, route.id);
});
