// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * c4-navigation.spec.ts — E2E for link-based C4 navigation.
 *
 * The model: one file = one diagram. A node carries a details.detailed-architecture
 * link; double-clicking it jumps to a read-only view of that document with a
 * breadcrumb; the root crumb returns to editing. There are NO level tabs.
 *
 * Flow:
 *   1. Load the Multi-Agent Reference Architecture template (its layer nodes link
 *      to detailed documents, registered as a series).
 *   2. Assert there is no "C4 view level" segmented control (tabs were removed).
 *   3. Double-click a drillable layer node → read-only nav + breadcrumb appear.
 *   4. Click the root breadcrumb crumb → back to editing (breadcrumb gone).
 *
 * Key UI:
 *   - drillable node: `.svelte-flow__node.c4-drillable`
 *   - C4Breadcrumb: role="navigation" aria-label="C4 navigation path";
 *     the root segment is a button, the current location a span (aria-current="page").
 */

import { test, expect, Page } from '@playwright/test';

async function loadMultiAgentTemplate(page: Page): Promise<void> {
  page.on('dialog', dialog => dialog.accept());

  await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

  const templatesBtn = page.getByRole('button', { name: /open template picker/i });
  await expect(templatesBtn).toBeVisible({ timeout: 10_000 });
  await templatesBtn.click();

  const modal = page.getByRole('dialog', { name: /template picker/i });
  await expect(modal).toBeVisible({ timeout: 10_000 });

  const card = page.getByRole('button', { name: /load template: multi-agent reference architecture/i });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();

  await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

test.describe('C4 link navigation', () => {
  test.setTimeout(120_000);

  test('no level tabs are present (link-based model)', async ({ page }) => {
    await page.goto('/');
    await loadMultiAgentTemplate(page);
    await expect(page.getByRole('group', { name: /c4 view level/i })).toHaveCount(0);
  });

  test('double-clicking a linked node opens a read-only view; the root crumb returns to editing', async ({ page }) => {
    await page.goto('/');
    await loadMultiAgentTemplate(page);

    // The layer nodes link to detailed documents → they carry the drill affordance.
    const drillable = page.locator('.svelte-flow__node.c4-drillable').first();
    await expect(drillable).toBeVisible({ timeout: 10_000 });
    await drillable.dblclick();

    // Read-only navigation engages → the breadcrumb appears.
    const breadcrumb = page.getByRole('navigation', { name: /c4 navigation path/i });
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });
    await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible();

    // The root crumb (first button) returns to editing — the breadcrumb goes away.
    await breadcrumb.getByRole('button').first().click();
    await page.waitForTimeout(1000);
    await expect(breadcrumb).not.toBeVisible({ timeout: 5_000 });
  });
});
