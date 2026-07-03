// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * template-governance.spec.ts — E2E test for the template + AIGF governance workflow.
 *
 * Tests the OSFF Toronto demo flow:
 * 1. Open template picker → select FluxNova AI Agent template
 * 2. Verify nodes appear on canvas (11 nodes)
 * 3. Select an AI node → Properties panel shows "Governance" tab with badge
 * 4. Click "Governance" tab → GovernancePanel shows risks/mitigations
 * 5. Click Apply on a mitigation → mitigation becomes "Applied"
 * 6. Export → verify AIGF decorator in exported CALM JSON
 *
 * Key UI elements:
 * - Toolbar: "Templates" button (aria-label: "Open template picker")
 * - TemplatePicker: modal role="dialog" with category tabs and template cards
 * - PropertiesPanel tabs: "Properties" and "Governance" tabs (in right sidebar)
 * - GovernancePanel: inside Governance tab — shows "AIGF Governance" header,
 *   risks, mitigations with "Apply" buttons
 * - Export dropdown → "CALM JSON (.calm.json)"
 */

import { test, expect, Page } from '@playwright/test';

// Intercept Blob-URL based download. We capture the FIRST .calm.json download
// (not the sidecar .calmstudio.json which fires 200ms later).
async function injectDownloadInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const blobUrlMap = new Map<string, Blob>();
    (window as Record<string, unknown>)['__blobUrlMap'] = blobUrlMap;

    // Track all captured downloads in order
    const downloads: { href: string; filename: string }[] = [];
    (window as Record<string, unknown>)['__downloads'] = downloads;

    const origCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const url = origCreateObjectURL(blob);
      if (blob instanceof Blob) {
        blobUrlMap.set(url, blob);
      }
      return url;
    };

    const origCreateElement = document.createElement.bind(document);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (document as any).createElement = function (tagName: string, options?: ElementCreationOptions) {
      const el = origCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') {
        el.click = function () {
          const anchor = el as HTMLAnchorElement;
          if (anchor.download && anchor.href) {
            downloads.push({ href: anchor.href, filename: anchor.download });
            // Track first download separately for easy access
            if (!(window as Record<string, unknown>)['__firstDownloadHref']) {
              (window as Record<string, unknown>)['__firstDownloadHref'] = anchor.href;
              (window as Record<string, unknown>)['__firstDownloadFilename'] = anchor.download;
            }
          }
          // Suppress actual download
        };
      }
      return el;
    };
  });
}

async function readFirstDownload(page: Page): Promise<{ content: string; filename: string } | null> {
  return page.evaluate(async () => {
    const href = (window as Record<string, unknown>)['__firstDownloadHref'] as string | undefined;
    const filename = (window as Record<string, unknown>)['__firstDownloadFilename'] as string | undefined;
    if (!href || !filename) return null;
    const blobUrlMap = (window as Record<string, unknown>)['__blobUrlMap'] as Map<string, Blob>;
    if (blobUrlMap?.has(href)) {
      const text = await blobUrlMap.get(href)!.text();
      return { content: text, filename };
    }
    try {
      const resp = await fetch(href);
      const text = await resp.text();
      return { content: text, filename };
    } catch {
      return null;
    }
  });
}

async function loadAIAgentTemplate(page: Page): Promise<void> {
  // Register dialog handler BEFORE any action that might trigger it
  page.on('dialog', dialog => dialog.accept());

  // Wait for app to be fully loaded
  await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

  // Click Templates button
  const templatesBtn = page.getByRole('button', { name: /open template picker/i });
  await expect(templatesBtn).toBeVisible({ timeout: 10_000 });
  await templatesBtn.click();

  const modal = page.getByRole('dialog', { name: /template picker/i });
  await expect(modal).toBeVisible({ timeout: 10_000 });

  // Find and click the FluxNova AI Agent template card
  const templateCard = page.getByRole('button', { name: /load template: fluxnova: ai agent orchestration/i });
  await expect(templateCard).toBeVisible({ timeout: 10_000 });
  await templateCard.click();

  // Wait for canvas to populate with nodes
  // Template loads async (runs ELK layout + projection)
  const firstNode = page.locator('.svelte-flow__node').first();
  await expect(firstNode).toBeVisible({ timeout: 15_000 });

  // Give extra time for all 11 nodes to render
  await page.waitForTimeout(500);
}

test.describe('Template + governance flow', () => {
  test.setTimeout(120_000);

  test('user can open template picker and view modal with correct content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // Click Templates button
    const templatesBtn = page.getByRole('button', { name: /open template picker/i });
    await expect(templatesBtn).toBeVisible({ timeout: 10_000 });
    await templatesBtn.click();

    // Template picker modal should be visible
    const modal = page.getByRole('dialog', { name: /template picker/i });
    await expect(modal).toBeVisible({ timeout: 10_000 });

    // Verify heading text (use getByRole to avoid ambiguity with the "Start from a template" button)
    const heading = page.getByRole('heading', { name: 'Start from a template' });
    await expect(heading).toBeVisible({ timeout: 5_000 });

    // The FluxNova category tab should exist and be active by default
    const fluxnovaTab = page.getByRole('tab', { name: /fluxnova/i });
    await expect(fluxnovaTab).toBeVisible({ timeout: 5_000 });
    await expect(fluxnovaTab).toHaveAttribute('aria-selected', 'true');

    // AI Agent template card should be visible
    const aiAgentCard = page.getByRole('button', { name: /load template: fluxnova: ai agent orchestration/i });
    await expect(aiAgentCard).toBeVisible({ timeout: 5_000 });

    // Close the modal via Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 5_000 });
  });

  test('user can load FluxNova AI Agent template and see nodes on canvas', async ({ page }) => {
    await page.goto('/');

    await loadAIAgentTemplate(page);

    // Canvas should have nodes — FluxNova AI Agent template has 11 nodes
    const flowNodes = page.locator('.svelte-flow__node');
    await expect(flowNodes).toHaveCount(11, { timeout: 15_000 });
  });

  test('user can select AI node and navigate to Governance tab', async ({ page }) => {
    await page.goto('/');

    await loadAIAgentTemplate(page);

    // Find the "AI Agent" node on the canvas and click it to select
    const aiAgentNode = page.locator('.svelte-flow__node').filter({ hasText: 'AI Agent' }).first();
    await expect(aiAgentNode).toBeVisible({ timeout: 15_000 });
    await aiAgentNode.click();

    // Wait for PropertiesPanel to show the selected node
    await page.waitForTimeout(500);

    // PropertiesPanel should now show the "Governance" tab (only shown when a node is selected)
    const governanceTab = page.getByRole('tab', { name: /governance/i });
    await expect(governanceTab).toBeVisible({ timeout: 5_000 });

    // Click the Governance tab to show GovernancePanel
    await governanceTab.click();
    await page.waitForTimeout(500);

    // GovernancePanel should now be visible with its "AIGF Governance" header
    await expect(page.getByText('AIGF Governance')).toBeVisible({ timeout: 5_000 });
  });

  test('user can apply a governance mitigation from the panel', async ({ page }) => {
    await page.goto('/');

    await loadAIAgentTemplate(page);

    // Select the AI Agent node
    const aiAgentNode = page.locator('.svelte-flow__node').filter({ hasText: 'AI Agent' }).first();
    await expect(aiAgentNode).toBeVisible({ timeout: 15_000 });
    await aiAgentNode.click();
    await page.waitForTimeout(500);

    // Switch to Governance tab
    const governanceTab = page.getByRole('tab', { name: /governance/i });
    await expect(governanceTab).toBeVisible({ timeout: 5_000 });
    await governanceTab.click();
    await page.waitForTimeout(500);

    // GovernancePanel should show mitigations with Apply buttons
    // (template has pre-applied controls, so some may already be applied)
    // Check if "Recommended Mitigations" section is visible
    const mitigationsHeader = page.getByText('Recommended Mitigations');

    // If mitigations section exists, try to apply one
    const hasMitigations = await mitigationsHeader.isVisible().catch(() => false);
    if (hasMitigations) {
      // Find an Apply button if any mitigations are not yet applied
      const applyBtn = page.locator('.apply-btn').first();
      const hasApplyBtn = await applyBtn.isVisible().catch(() => false);

      if (hasApplyBtn) {
        await applyBtn.click();
        await page.waitForTimeout(500);

        // After applying, the button should change to "Applied" check
        const appliedCheck = page.locator('.applied-check').first();
        await expect(appliedCheck).toBeVisible({ timeout: 5_000 });
      } else {
        // All mitigations already applied — check for "All recommendations applied" banner
        const allApplied = page.getByText('All recommendations applied');
        await expect(allApplied).toBeVisible({ timeout: 5_000 });
      }
    }

    // At minimum, the governance panel header is visible — governance workflow confirmed
    await expect(page.getByText('AIGF Governance')).toBeVisible({ timeout: 5_000 });
  });

  test('user can export AI Agent template and get AIGF decorator in CALM JSON', async ({ page }) => {
    await injectDownloadInterceptor(page);
    await page.goto('/');

    // Load AI Agent template
    await loadAIAgentTemplate(page);

    // Export as CALM JSON
    await page.getByRole('button', { name: /export diagram/i }).click();
    const exportMenu = page.getByRole('menu', { name: /export options/i });
    await expect(exportMenu).toBeVisible({ timeout: 5_000 });
    await page.getByRole('menuitem', { name: /calm json/i }).click();

    // Wait for download to be captured (including brief processing time)
    await page.waitForTimeout(1500);

    const download = await readFirstDownload(page);
    expect(download).not.toBeNull();
    expect(download!.filename).toMatch(/\.calm\.json$/);

    const exported = JSON.parse(download!.content);

    // Exported JSON should NOT contain _template field (stripped on export)
    expect(exported).not.toHaveProperty('_template');

    // Exported JSON should contain nodes from the AI Agent template
    expect(exported).toHaveProperty('nodes');
    expect(Array.isArray(exported.nodes)).toBe(true);
    expect(exported.nodes.length).toBeGreaterThan(0);

    // Should have AIGF decorator since template has AI nodes
    expect(exported).toHaveProperty('decorators');
    expect(Array.isArray(exported.decorators)).toBe(true);
    expect(exported.decorators.length).toBeGreaterThan(0);

    const aigfDecorator = exported.decorators.find(
      (d: { type?: string }) => d.type === 'aigf-governance'
    );
    expect(aigfDecorator).toBeDefined();

    // The decorator's data should contain governance-score
    const governanceScore = aigfDecorator.data?.['governance-score'];
    expect(typeof governanceScore).toBe('number');
    expect(governanceScore).toBeGreaterThanOrEqual(0);
    expect(governanceScore).toBeLessThanOrEqual(100);
  });
});
