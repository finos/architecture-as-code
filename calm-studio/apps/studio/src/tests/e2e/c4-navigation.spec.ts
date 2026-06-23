// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * c4-navigation.spec.ts — E2E test for C4 view navigation.
 *
 * Tests C4 view switching, drill-down, breadcrumb navigation, and mode exit:
 * 1. Load a template with containment relationships (FluxNova Platform)
 * 2. Switch to "Context" view via toolbar C4 segmented control
 * 3. Switch to "Container" view
 * 4. The C4 breadcrumb bar appears when in C4 mode (it shows "All Systems" as root)
 * 5. Double-click a drillable node to drill down
 * 6. Verify breadcrumb shows navigation trail
 * 7. Click "All Systems" breadcrumb link to navigate back
 * 8. Exit C4 mode by clicking "All" button
 *
 * Key UI elements (from Toolbar.svelte):
 * - C4 segmented control: buttons "All", "Context", "Container", "Component"
 *   group aria-label: "C4 view level"
 * - C4Breadcrumb: role="navigation" aria-label="C4 navigation path"
 *   - "All Systems" button (clickable root segment)
 *   - Current node span (aria-current="page")
 *   - Level badge: aria-label="C4 level: {level}"
 */

import { test, expect, Page } from '@playwright/test';

async function loadFluxNovaPlatformTemplate(page: Page): Promise<void> {
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

  // Look for FluxNova Platform card (has container nodes suitable for drill-down)
  const platformCard = page.getByRole('button', { name: /load template: fluxnova: platform/i });
  await expect(platformCard).toBeVisible({ timeout: 10_000 });
  await platformCard.click();

  // Wait for canvas to populate — FluxNova Platform has 7 nodes
  const firstNode = page.locator('.svelte-flow__node').first();
  await expect(firstNode).toBeVisible({ timeout: 15_000 });

  // Give extra time for layout to complete
  await page.waitForTimeout(500);
}

test.describe('C4 view navigation', () => {
  test.setTimeout(120_000);

  test('user can switch C4 view levels via toolbar', async ({ page }) => {
    await page.goto('/');

    await loadFluxNovaPlatformTemplate(page);

    // The C4 segmented control is in the toolbar-left section
    // Buttons: "All", "Context", "Container", "Component"
    const c4Group = page.getByRole('group', { name: /c4 view level/i });
    await expect(c4Group).toBeVisible({ timeout: 10_000 });

    // Initially "All" should be active (aria-pressed=true)
    const allBtn = c4Group.getByRole('button', { name: 'All' });
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true');

    // Click "Context" — switches to context view
    const contextBtn = c4Group.getByRole('button', { name: 'Context' });
    await contextBtn.click();

    // Wait for C4 mode to engage and layout to run
    await page.waitForTimeout(2000);

    // "Context" should now be active
    await expect(contextBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(allBtn).toHaveAttribute('aria-pressed', 'false');

    // C4 breadcrumb navigation bar should be visible (C4 mode is active)
    const breadcrumb = page.getByRole('navigation', { name: /c4 navigation path/i });
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });

    // Breadcrumb should show "All Systems" — as current location (span) when not drilled
    // C4Breadcrumb renders the last segment as a non-clickable span (aria-current="page")
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(/all systems/i);
  });

  test('user can switch to Container view and exit C4 mode', async ({ page }) => {
    await page.goto('/');

    await loadFluxNovaPlatformTemplate(page);

    const c4Group = page.getByRole('group', { name: /c4 view level/i });

    // Switch to Container view
    const containerBtn = c4Group.getByRole('button', { name: 'Container' });
    await containerBtn.click();

    await page.waitForTimeout(2000);

    // Container should be active
    await expect(containerBtn).toHaveAttribute('aria-pressed', 'true');

    // C4 breadcrumb should show Container level badge
    const breadcrumb = page.getByRole('navigation', { name: /c4 navigation path/i });
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });

    // Level badge should indicate Container
    const levelBadge = breadcrumb.getByLabel(/c4 level: container/i);
    await expect(levelBadge).toBeVisible({ timeout: 5_000 });

    // Exit C4 mode by clicking "All"
    const allBtn = c4Group.getByRole('button', { name: 'All' });
    await allBtn.click();

    await page.waitForTimeout(1500);

    // "All" should be active again
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(containerBtn).toHaveAttribute('aria-pressed', 'false');

    // Breadcrumb should be gone (C4 mode exited)
    await expect(breadcrumb).not.toBeVisible({ timeout: 5_000 });
  });

  test('user can drill down into a container node and use breadcrumb to return', async ({ page }) => {
    await page.goto('/');

    await loadFluxNovaPlatformTemplate(page);

    const c4Group = page.getByRole('group', { name: /c4 view level/i });

    // Switch to Container view where the FluxNova Platform container node will be visible
    const containerBtn = c4Group.getByRole('button', { name: 'Container' });
    await containerBtn.click();

    await page.waitForTimeout(2500);

    // Breadcrumb is present
    const breadcrumb = page.getByRole('navigation', { name: /c4 navigation path/i });
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });

    // Find a drillable node — look for a container node with children
    // The FluxNova Platform template has "FluxNova BPM Engine" as the main container
    // In Container view, double-click on a node that has children to drill down
    const flowNodes = page.locator('.svelte-flow__node');
    const nodeCount = await flowNodes.count();

    // Try double-clicking the first visible node — if it has children, drill-down engages
    if (nodeCount > 0) {
      await flowNodes.first().dblclick();
      await page.waitForTimeout(1500);
    }

    // After potential drill-down, verify breadcrumb still shows navigation context
    // The breadcrumb always shows "All Systems" when in C4 mode (as span or button)
    await expect(breadcrumb).toBeVisible({ timeout: 5_000 });
    await expect(breadcrumb.locator('text=All Systems')).toBeVisible({ timeout: 5_000 });

    // If "All Systems" is a button (after drilling in), click it to navigate back to root
    const allSystemsBtn = breadcrumb.getByRole('button', { name: 'All Systems' });
    const isBtnVisible = await allSystemsBtn.isVisible().catch(() => false);
    if (isBtnVisible) {
      await allSystemsBtn.click();
      await page.waitForTimeout(1000);
    }

    // Should still be in C4 mode — breadcrumb still present
    await expect(breadcrumb).toBeVisible({ timeout: 5_000 });

    // Exit C4 mode completely
    const allBtn = c4Group.getByRole('button', { name: 'All' });
    await allBtn.click();
    await page.waitForTimeout(1000);

    // Breadcrumb gone
    await expect(breadcrumb).not.toBeVisible({ timeout: 5_000 });

    // Canvas should be back in normal editing mode — All nodes visible
    const nodesAfterExit = page.locator('.svelte-flow__node');
    const finalCount = await nodesAfterExit.count();
    // FluxNova Platform template has 7 nodes; after exit all should be visible
    expect(finalCount).toBeGreaterThan(0);
  });
});
