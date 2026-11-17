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

test('each screen has its own route, which returns blocks with the screen title', () => {
    const routes = new Map(manifest.routes.map((r) => [r.id, r]));
    assert.deepEqual(manifest.contributes.screen.map((s) => s.title), ['Releases', 'Release calendar']);
    for (const screen of manifest.contributes.screen) {
        const reply = get(routes.get(screen.route).path);
        assert.equal(reply.title, screen.title);
        assert.ok(reply.blocks.length > 0, screen.id);
    }
});

test('every GET route that a UI contribution names is readOnly', () => {
    const routes = new Map(manifest.routes.map((r) => [r.id, r]));
    const gets = Object.values(manifest.contributes).flat().map((c) => routes.get(c.route)).filter((r) => r?.method === 'GET');
    assert.ok(gets.length >= 4);
    for (const route of gets) assert.equal(route.readOnly, true, route.id);
});

test('the screen links each release to its component and declares a status filter', () => {
    const { blocks } = get('/screen');
    const table = blocks.find((block) => block.id === 'releases');
    const filter = blocks.filter((block) => block.type === 'stats').flatMap((block) => block.items)
        .find((item) => item.filter?.id === 'released').filter;
    const rows = table.rows.filter((row) => row[table.columns.indexOf(filter.column)].badge === filter.value);

    assert.deepEqual(rows.map((row) => row[0]), ['2.3.1', '2.2.0']);
    assert.deepEqual(rows[0][3], {
        label: 'web-app',
        hub: { namespace: 'demo', type: 'architectures', id: '1', version: '1.0.0', element: 'web-app' },
    });
});

test('the designer tab links to the screen for the same resource and element', () => {
    const reply = get('/tab/architectures/1?namespace=demo&version=1.0.0&selectedElement=web-app');

    assert.deepEqual(reply.blocks.at(-1).items[0].screen, {
        extension: 'release-tracker',
        screen: 'releases',
        context: { namespace: 'demo', type: 'architectures', id: '1', version: '1.0.0', element: 'web-app' },
    });
});

test('each screen tile filter selects as many rows as its figure', () => {
    const { blocks } = get('/screen');
    const tables = new Map(blocks.filter((b) => b.type === 'table' && b.id).map((b) => [b.id, b]));
    const tiles = blocks.filter((b) => b.type === 'stats').flatMap((b) => b.items).filter((item) => item.filter);
    assert.equal(tiles.length, 7);
    for (const { label, value, filter } of tiles) {
        const table = tables.get(filter.table);
        assert.ok(table, label);
        const total = table.source
            ? get(`/deployments?${filter.id ? `filter=${filter.id}&` : ''}pageSize=100`).total
            : table.rows.filter((row) => !filter.id || row[table.columns.indexOf(filter.column)].badge === filter.value).length;
        assert.equal(total, value, label);
    }
});

test('the deployments route filters the whole dataset, then returns one page', () => {
    assert.equal(manifest.routes.find((r) => r.id === 'deployments').readOnly, true);
    const failed = get('/deployments?filter=failed&page=1&pageSize=3');
    assert.equal(failed.total, 4);
    assert.deepEqual(failed.rows.map((row) => row[0]), ['deploy-003', 'deploy-009', 'deploy-014']);
    assert.deepEqual(get('/deployments?filter=failed&page=2&pageSize=3').rows.map((row) => row[0]), ['deploy-020']);

    const search = get('/deployments?filter=failed&q=user-service&pageSize=3');
    assert.deepEqual([search.total, search.rows.map((row) => row[0])], [2, ['deploy-009', 'deploy-014']]);
});
