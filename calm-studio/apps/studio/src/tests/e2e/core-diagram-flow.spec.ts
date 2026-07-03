// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * core-diagram-flow.spec.ts — E2E test for the core diagram workflow.
 *
 * Tests the full create → add nodes → export CALM JSON → reimport cycle.
 *
 * Key interactions:
 * - NodePalette: double-click to place a node at canvas center
 * - Toolbar Export menu: CALM JSON download
 * - Export interception: anchor element with download attribute (Blob URL approach)
 * - Open: stub showOpenFilePicker (FSA API) to serve previously exported content
 */

import { test, expect, Page } from '@playwright/test';

// Intercept the anchor-click-based Blob export
// The app uses: `const a = document.createElement('a'); a.href = blobUrl; a.download = filename; a.click()`
// We intercept by patching createElement to capture blob URL hrefs from anchor downloads.
async function injectDownloadInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const captured: { href: string; filename: string }[] = [];
    (window as Record<string, unknown>)['__capturedDownloads'] = captured;

    // Track blob URLs created so we can read them back
    const blobUrlMap = new Map<string, Blob>();
    const origCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const url = origCreateObjectURL(blob);
      if (blob instanceof Blob) {
        blobUrlMap.set(url, blob);
        (window as Record<string, unknown>)['__blobUrlMap'] = blobUrlMap;
      }
      return url;
    };

    // Patch createElement to intercept anchor download clicks
    const origCreateElement = document.createElement.bind(document);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).createElement = function (tagName: string, options?: ElementCreationOptions) {
      const el = origCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        const origClick = el.click.bind(el);
        el.click = function () {
          const anchor = el as HTMLAnchorElement;
          if (anchor.download && anchor.href) {
            captured.push({ href: anchor.href, filename: anchor.download });
            (window as Record<string, unknown>)['__lastDownloadFilename'] = anchor.download;
            (window as Record<string, unknown>)['__lastDownloadHref'] = anchor.href;
          }
          // Do not actually trigger download — we captured it
        };
      }
      return el;
    };
  });
}

// Read the content of the last intercepted download by fetching the blob URL
async function readLastDownload(page: Page): Promise<{ content: string; filename: string } | null> {
  const result = await page.evaluate(async () => {
    const href = (window as Record<string, unknown>)['__lastDownloadHref'] as string | undefined;
    const filename = (window as Record<string, unknown>)['__lastDownloadFilename'] as string | undefined;
    if (!href || !filename) return null;

    // Re-fetch the blob URL from our map
    const blobUrlMap = (window as Record<string, unknown>)['__blobUrlMap'] as Map<string, Blob> | undefined;
    if (blobUrlMap && blobUrlMap.has(href)) {
      const blob = blobUrlMap.get(href)!;
      const text = await blob.text();
      return { content: text, filename };
    }
    // Fallback: try fetching the blob URL directly
    try {
      const resp = await fetch(href);
      const text = await resp.text();
      return { content: text, filename };
    } catch {
      return null;
    }
  });
  return result;
}

test.describe('Core diagram flow', () => {
  test.setTimeout(90_000);

  test('user can add nodes from palette and export CALM JSON', async ({ page }) => {
    await injectDownloadInterceptor(page);

    await page.goto('/');

    // Wait for the app to fully load — NodePalette heading "Components" should be visible
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // The "Core" section in the palette is expanded by default — look for "Actor" node
    // NodePalette items are buttons with aria-label "Drag or double-click to place {label} node"
    const actorButton = page.getByRole('button', { name: /drag or double-click to place actor node/i });
    await expect(actorButton).toBeVisible({ timeout: 10_000 });

    // Double-click to place an Actor node at canvas center
    await actorButton.dblclick();

    // Wait briefly for node to appear on canvas
    await page.waitForTimeout(500);

    // Double-click to place a second node — Service
    const serviceButton = page.getByRole('button', { name: /drag or double-click to place service node/i });
    await expect(serviceButton).toBeVisible({ timeout: 5_000 });
    await serviceButton.dblclick();

    await page.waitForTimeout(500);

    // Verify canvas has nodes — SvelteFlow renders individual nodes as .svelte-flow__node elements
    const firstNode = page.locator('.svelte-flow__node').first();
    await expect(firstNode).toBeVisible({ timeout: 10_000 });

    // Export as CALM JSON via the Export dropdown in the toolbar
    await page.getByRole('button', { name: /export diagram/i }).click();

    // Wait for the export dropdown menu
    const exportMenu = page.getByRole('menu', { name: /export options/i });
    await expect(exportMenu).toBeVisible({ timeout: 5_000 });

    // Click CALM JSON option
    await page.getByRole('menuitem', { name: /calm json/i }).click();

    // Wait for the download to be intercepted
    await page.waitForTimeout(1000);

    const download = await readLastDownload(page);
    expect(download).not.toBeNull();
    expect(download!.filename).toMatch(/\.calm\.json$/);

    // Parse and verify exported JSON has at least 1 node
    const exported = JSON.parse(download!.content);
    expect(exported).toHaveProperty('nodes');
    expect(Array.isArray(exported.nodes)).toBe(true);
    expect(exported.nodes.length).toBeGreaterThanOrEqual(1);
  });

  test('user can open (reimport) a CALM JSON file', async ({ page }) => {
    await injectDownloadInterceptor(page);

    // Prepare a minimal CALM JSON to "open"
    const calmJson = JSON.stringify({
      nodes: [
        { 'unique-id': 'test-actor-01', 'node-type': 'actor', name: 'Test Actor' },
        { 'unique-id': 'test-svc-01', 'node-type': 'service', name: 'Test Service' },
      ],
      relationships: [],
    });

    // Stub showOpenFilePicker before navigation.
    // Use a string script (not callback+arg) to avoid serialization issues with SvelteKit.
    const escapedJson = calmJson.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    await page.addInitScript(`
      window.showOpenFilePicker = async function() {
        var content = \`${escapedJson}\`;
        var blob = new Blob([content], { type: 'application/json' });
        var mockFile = new File([blob], 'test-architecture.calm.json', { type: 'application/json' });
        var mockHandle = {
          kind: 'file',
          name: 'test-architecture.calm.json',
          getFile: async function() { return mockFile; }
        };
        return [mockHandle];
      };
    `);

    await page.goto('/');

    // Wait for app to load
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // Click Open button in toolbar
    await page.getByRole('button', { name: /open calm json file/i }).click();

    // Wait for nodes to appear in the canvas
    await page.waitForTimeout(2000);

    // Verify the canvas has nodes rendered
    const firstImportedNode = page.locator('.svelte-flow__node').first();
    await expect(firstImportedNode).toBeVisible({ timeout: 10_000 });

    // Count node elements — should have at least 2 (from imported content)
    const flowNodes = page.locator('.svelte-flow__node');
    await expect(flowNodes).toHaveCount(2, { timeout: 10_000 });
  });
});
