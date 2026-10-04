import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const architecture = JSON.stringify({ nodes: [
  { 'unique-id': 'client', 'node-type': 'actor', name: 'Customer', description: 'Places an order' },
  { 'unique-id': 'api', 'node-type': 'service', name: 'Order service', description: 'Handles orders' },
], relationships: [{ 'unique-id': 'request', 'relationship-type': { connects: { source: { node: 'client' }, destination: { node: 'api' } } }, protocol: 'HTTPS', description: 'Sends an order' }] });

test('packaged bundle renders offline under the embedded browser CSP', async ({ page }) => {
  await page.setViewportSize({ width: 1742, height: 1408 });
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  const script = readFileSync('dist/index.js', 'utf8').replace(/<\/script/gi, '<\\/script');
  const css = readFileSync('dist/index.css', 'utf8');
  await page.setContent(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-test'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none';"><style>${css}</style></head><body><div id="root"></div><script nonce="test">window.calmHost={postMessage:function(){}};</script><script nonce="test">${script}</script></body></html>`);
  await expect(page.getByText('Open a CALM architecture')).toBeVisible();
  await page.evaluate(json => window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'modelUpdated', documentId: 'file:///sample.calm.json', fileName: 'fluxnova.architecture.json', revision: 1, json },
  })), readFileSync('tests/fixtures/fluxnova.architecture.json', 'utf8'));
  await expect(page.locator('.canvas g.node')).toHaveCount(10);
  await expect(page.locator('.canvas .cluster')).toHaveCount(1);
  await expect(page.locator('.canvas .cluster > rect')).toHaveCSS('fill', 'rgb(67, 67, 67)');
  await expect(page.getByRole('checkbox', { name: 'Show Labels' })).not.toBeChecked();
  await expect(page.locator('.canvas .edgeLabel').filter({ hasText: /\S/ })).toHaveCount(0);
  const originalBox = await page.locator('.canvas > svg').getAttribute('viewBox');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('.canvas > svg')).not.toHaveAttribute('viewBox', originalBox!);
  await page.getByRole('button', { name: 'Fit diagram' }).click();
  await expect(page.locator('.canvas > svg')).toHaveAttribute('viewBox', originalBox!);
  await page.screenshot({ path: '../../../sandbox/intellij/fluxnova-labels-off.png' });
  expect(failures).toEqual([]);
});

test('renders, inspects, refreshes and reports malformed JSON without editing', async ({ page }) => {
  const outgoing: string[] = [];
  await page.exposeFunction('captureMessage', (message: string) => outgoing.push(message));
  await page.addInitScript(() => { (window as any).calmHost = { postMessage: (message: string) => (window as any).captureMessage(message) }; });
  await page.goto('/');
  await expect(page.getByText('Open a CALM architecture')).toBeVisible();
  const publish = (json: string, revision: number) => page.evaluate(({ json, revision }) => window.dispatchEvent(new MessageEvent('message', {
    data: { type: 'modelUpdated', documentId: 'file:///sample.calm.json', fileName: 'sample.calm.json', revision, json },
  })), { json, revision });
  await publish(architecture, 1);
  await expect(page.locator('.canvas g.node')).toHaveCount(2);
  await page.locator('[data-calm-id=api]').click();
  await expect(page.getByRole('complementary', { name: 'Node details' })).toContainText('Handles orders');
  await page.keyboard.press('Delete');
  await expect(page.locator('.canvas g.node')).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Show Labels' }).check();
  await expect(page.locator('.canvas')).toContainText('Sends an order');
  await publish(architecture.replace('Order service', 'Updated service'), 2);
  await expect(page.locator('[data-calm-id=api]')).toContainText('Updated service');
  await publish(architecture, 1);
  await expect(page.locator('[data-calm-id=api]')).toContainText('Updated service');
  await page.screenshot({ path: '../../../sandbox/intellij/canvas-preview.png' });
  await publish('{ invalid', 3);
  await expect(page.getByRole('alert')).toContainText('Cannot preview');
  await expect(page.locator('.canvas g.node')).toHaveCount(0);
  await publish(architecture, 4);
  await expect(page.locator('.canvas g.node')).toHaveCount(2);
  expect(outgoing).toEqual(['ready']);
});

test('edits nodes and connections through versioned requests and waits for host acknowledgement', async ({ page }) => {
  const outgoing: string[] = [];
  await page.exposeFunction('captureMessage', (message: string) => outgoing.push(message));
  await page.addInitScript(() => { (window as any).calmHost = { postMessage: (message: string) => (window as any).captureMessage(message) }; });
  await page.goto('/');
  let revision = 0;
  const publish = (json: string, version = String(++revision), writable = true) => page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data })), {
    type: 'modelUpdated', documentId: 'file:///sample.calm.json', fileName: 'sample.calm.json', revision: revision + 1, version, writable, canUndo: true, canRedo: true, json,
  });
  const acknowledge = async (request: any, ok = true) => page.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data })), { type: 'editResult', requestId: request.requestId, ok, error: ok ? undefined : 'The document changed.' });
  await publish(architecture);
  await page.locator('[data-calm-id=api]').click();
  await page.getByLabel('Node type', { exact: true }).selectOption('__custom__');
  await page.getByLabel('Node type (custom)').fill('custom-service');
  await page.getByLabel('Name', { exact: true }).fill('Edited service');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(() => outgoing.length).toBe(2);
  let request = JSON.parse(outgoing[1]);
  expect(request).toMatchObject({ type: 'applyEdit', version: '1', documentId: 'file:///sample.calm.json' });
  expect(JSON.parse(request.json).nodes[1].name).toBe('Edited service');
  expect(JSON.parse(request.json).nodes[1]['node-type']).toBe('custom-service');
  await expect(page.getByRole('button', { name: 'Applying…' })).toBeDisabled();
  await acknowledge(request); await publish(request.json);
  let current = request.json;
  await expect(page.locator('[data-calm-id=api]')).toContainText('Edited service');
  await page.getByRole('button', { name: 'Add node', exact: true }).click();
  await page.getByLabel('Unique ID').fill('db');
  await page.getByLabel('Name', { exact: true }).fill('Database');
  await page.getByLabel('Node type', { exact: true }).selectOption('database');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(() => outgoing.length).toBe(3); request = JSON.parse(outgoing[2]);
  await acknowledge(request); await publish(request.json); current = request.json;
  await expect(page.locator('.canvas g.node')).toHaveCount(3);
  await page.getByRole('button', { name: 'Add connection', exact: true }).click();
  await page.getByLabel('Unique ID').fill('stores');
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('api');
  await page.getByRole('combobox', { name: 'Destination', exact: true }).selectOption('db');
  await page.getByLabel('Protocol', { exact: true }).selectOption('HTTPS');
  await page.getByLabel('Description').fill('Stores orders');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(() => outgoing.length).toBe(4); request = JSON.parse(outgoing[3]);
  expect(JSON.parse(request.json).relationships).toHaveLength(2);
  expect(JSON.parse(request.json).relationships[1].protocol).toBe('HTTPS');
  await acknowledge(request); await publish(request.json); current = request.json;
  await page.getByRole('button', { name: 'Edit items' }).click();
  await page.getByRole('button', { name: 'stores', exact: true }).click();
  await expect(page.getByLabel('Protocol', { exact: true })).toHaveValue('HTTPS');
  await page.getByLabel('Protocol', { exact: true }).selectOption('__custom__');
  await page.getByLabel('Protocol (custom)').fill('CUSTOM-RPC');
  await page.getByLabel('Description').fill('Persists orders');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(() => outgoing.length).toBe(5); request = JSON.parse(outgoing[4]);
  expect(JSON.parse(request.json).relationships[1].protocol).toBe('CUSTOM-RPC');
  await acknowledge(request); await publish(request.json); current = request.json;
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(() => outgoing.length).toBe(6); request = JSON.parse(outgoing[5]);
  expect(request.type).toBe('undo'); await acknowledge(request); await publish(current);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(() => outgoing.length).toBe(7); request = JSON.parse(outgoing[6]);
  expect(request.type).toBe('redo'); await acknowledge(request); await publish(current);
  // A draft must never overwrite a concurrent text edit.
  await page.locator('[data-calm-id=api]').click();
  await expect(page.getByLabel('Node type (custom)')).toHaveValue('custom-service');
  await page.getByLabel('Name', { exact: true }).fill('Unsaved form draft');
  await publish(current.replace('Edited service', 'External edit'));
  await expect(page.getByRole('alert')).toContainText('document changed');
  await expect(page.getByRole('button', { name: 'Apply changes' })).toBeDisabled();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unsaved form draft');
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.locator('[data-calm-id=api]').click();
  await page.getByRole('button', { name: 'Apply changes' }).click();
  await expect.poll(() => outgoing.length).toBe(8); request = JSON.parse(outgoing[7]);
  await acknowledge(request, false);
  await expect(page.getByRole('alert')).toContainText('document changed');
  await expect(page.getByRole('button', { name: 'Apply changes' })).toBeEnabled();
  await page.getByRole('button', { name: 'Close details' }).click();
  await publish(current, String(++revision), false);
  await expect(page.getByRole('button', { name: 'Add node', exact: true })).toBeDisabled();
});

test('clicks connection curves with labels off and selects parallel and reverse relationships', async ({ page }) => {
  await page.addInitScript(() => { (window as any).calmHost = { postMessage() {} }; });
  await page.goto('/');
  const model = JSON.parse(architecture);
  model.relationships.push({ ...model.relationships[0], 'unique-id': 'parallel', description: 'Second connection' });
  model.relationships.push({ 'unique-id': 'reverse', 'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'client' } } }, description: 'Returns order' });
  await page.evaluate(json => window.dispatchEvent(new MessageEvent('message', { data: {
    type: 'modelUpdated', documentId: 'file:///sample.calm.json', fileName: 'sample.calm.json', revision: 1, version: '1', writable: true, json,
  } })), JSON.stringify(model));
  await expect(page.locator('.canvas g.node')).toHaveCount(2);
  await expect(page.locator('.connection-hit')).toHaveCount(3);
  await expect(page.getByRole('checkbox', { name: 'Show Labels' })).not.toBeChecked();
  for (const id of ['request', 'parallel', 'reverse']) {
    const path = page.getByRole('button', { name: `Edit connection ${id}`, exact: true });
    const point = await path.evaluate(element => {
      const curve = element as SVGPathElement;
      return new DOMPoint(curve.getPointAtLength(curve.getTotalLength() / 2).x, curve.getPointAtLength(curve.getTotalLength() / 2).y).matrixTransform(curve.getScreenCTM()!).toJSON();
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.getByLabel('Unique ID')).toHaveValue(id);
    await page.getByRole('button', { name: 'Close details' }).click();
  }
  await page.getByRole('checkbox', { name: 'Show Labels' }).check();
  await expect(page.locator('.canvas')).toContainText('Second connection');
  const path = page.getByRole('button', { name: 'Edit connection parallel', exact: true });
  await path.focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Unique ID')).toHaveValue('parallel');
  await page.getByRole('button', { name: 'Close details' }).click();
  await page.locator('.canvas .edgeLabel').filter({ hasText: 'Second connection' }).click();
  await expect(page.getByLabel('Unique ID')).toHaveValue('parallel');
});


test('IDE colors update containers, edges and forms without resetting zoom or drafts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Open a CALM architecture')).toBeVisible();
  await page.evaluate(json => window.dispatchEvent(new MessageEvent('message', { data: {
    type: 'modelUpdated', documentId: 'file:///fluxnova.json', fileName: 'fluxnova.json',
    revision: 1, version: '1', writable: true, json,
  } })), readFileSync('tests/fixtures/fluxnova.architecture.json', 'utf8'));
  await expect(page.locator('.canvas .cluster')).toHaveCount(1);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const viewBox = await page.locator('.canvas > svg').getAttribute('viewBox');
  await page.getByRole('button', { name: 'Add node', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Unfinished edit');
  const colors = { background: '#fafafa', foreground: '#202020', muted: '#666666', border: '#888888',
    button: '#eeeeee', buttonText: '#222222', input: '#ffffff', inputText: '#222222', accent: '#2255aa',
    accentText: '#ffffff', selection: '#2255aa', error: '#aa2222', node: '#f0f0f0', container: '#e0e0e0' };
  const publishTheme = (colors: Record<string, string>, dark: boolean) => page.evaluate(data =>
    window.dispatchEvent(new MessageEvent('message', { data })), { type: 'themeUpdated', colors, dark });
  await publishTheme(colors, false);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(250, 250, 250)');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await expect(page.locator('.cluster > rect')).toHaveCSS('fill', 'rgb(224, 224, 224)');
  await expect(page.locator('path.flowchart-link').first()).toHaveCSS('stroke', 'rgb(32, 32, 32)');
  await expect(page.locator('.node rect').first()).toHaveCSS('fill', 'rgb(240, 240, 240)');
  await expect(page.locator('.cluster-label text').first()).toHaveCSS('fill', 'rgb(32, 32, 32)');
  await expect(page.getByLabel('Name', { exact: true })).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: '../../../sandbox/intellij/theme-light.png' });
  await publishTheme({ ...colors, background: '#202530', foreground: '#eeeeff', container: '#303545',
    node: '#252a35', input: '#252a35', inputText: '#eeeeff', button: '#353a45', buttonText: '#eeeeff' }, true);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(32, 37, 48)');
  await expect(page.locator('.cluster > rect')).toHaveCSS('fill', 'rgb(48, 53, 69)');
  await expect(page.locator('path.flowchart-link').first()).toHaveCSS('stroke', 'rgb(238, 238, 255)');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('.canvas > svg')).toHaveAttribute('viewBox', viewBox!);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Unfinished edit');
  await page.screenshot({ path: '../../../sandbox/intellij/theme-dark.png' });
  await publishTheme({ ...colors, background: 'url(https://invalid.example)' }, false);
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(32, 37, 48)');
  await page.getByRole('checkbox', { name: 'Show Labels' }).check();
  await expect(page.locator('.canvas .edgeLabel').filter({ hasText: /\S/ }).first()).toBeVisible();
  await expect(page.locator('.cluster > rect')).toHaveCSS('fill', 'rgb(48, 53, 69)');
});
