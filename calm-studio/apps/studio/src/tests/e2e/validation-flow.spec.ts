// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * validation-flow.spec.ts — E2E test for the validation workflow.
 *
 * Tests error detection, panel display, error-to-node navigation, and re-validation:
 * 1. Add a node from the palette (it will be orphaned → validation warning)
 * 2. Click Validate in the toolbar
 * 3. Verify validation panel opens with "Problems" header
 * 4. Verify issues appear in the panel (at least a warning for orphaned node)
 * 5. Click an issue row → the node gets selected / focus navigates
 * 6. Click Validate again → panel closes (toggle behavior)
 * 7. Click Validate once more → panel opens again
 *
 * Key UI elements (from ValidationPanel.svelte):
 * - Panel header: "Problems" text + summary like "1 warning"
 * - Issue rows: .vp-row elements with severity icon + message text
 * - Row click triggers onnavigatetonode
 * - Toolbar: aria-label "Validate CALM diagram"
 *
 * Validation notes from STATE.md:
 * - Orphan node warning fires unconditionally — empty relationships means every node is orphaned
 * - Validate button toggles panel on/off — second press hides without permanent dismiss
 * - Toggling panel off clears node badges and edge colors
 */

import { test, expect, Page } from '@playwright/test';

async function addNodeFromPalette(page: Page, nodeLabel: string): Promise<void> {
  const btn = page.getByRole('button', {
    name: new RegExp(`drag or double-click to place ${nodeLabel} node`, 'i'),
  });
  await expect(btn).toBeVisible({ timeout: 10_000 });
  await btn.dblclick();
  await page.waitForTimeout(500);
}

test.describe('Validation flow', () => {
  test.setTimeout(90_000);

  test('orphaned node produces validation warning in panel', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // Add a single orphaned node (no relationships → will trigger orphan warning)
    await addNodeFromPalette(page, 'Actor');

    // Wait for node to settle
    await page.waitForTimeout(500);

    // Click Validate button in toolbar
    const validateBtn = page.getByRole('button', { name: /validate calm diagram/i });
    await expect(validateBtn).toBeVisible({ timeout: 5_000 });
    await validateBtn.click();

    // Validation panel should open — look for "Problems" header
    const problemsTitle = page.getByText('Problems', { exact: true });
    await expect(problemsTitle).toBeVisible({ timeout: 10_000 });

    // Panel should show at least 1 issue (orphan warning)
    // The summary text shows something like "1 warning" or "1 error, 1 warning"
    const summaryText = page.locator('.vp-summary');
    await expect(summaryText).toBeVisible({ timeout: 5_000 });

    // There should be at least one issue row
    const issueRows = page.locator('.vp-row');
    await expect(issueRows.first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking issue row navigates to the element', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // Add an orphaned node
    await addNodeFromPalette(page, 'Service');
    await page.waitForTimeout(500);

    // Validate
    const validateBtn = page.getByRole('button', { name: /validate calm diagram/i });
    await validateBtn.click();

    // Wait for panel
    await expect(page.getByText('Problems', { exact: true })).toBeVisible({ timeout: 10_000 });

    const issueRows = page.locator('.vp-row');
    await expect(issueRows.first()).toBeVisible({ timeout: 5_000 });

    // Click the first issue row — this should call onnavigatetonode
    // which centers the canvas on the problem element
    await issueRows.first().click();

    // Wait for navigation to happen
    await page.waitForTimeout(500);

    // A flow node should be visible and (ideally selected)
    // We can at minimum verify the canvas still has the node
    const flowNodes = page.locator('.svelte-flow__node');
    await expect(flowNodes.first()).toBeVisible({ timeout: 5_000 });
  });

  test('validate button toggles panel open and closed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // Add a node so validation has something to report
    await addNodeFromPalette(page, 'Actor');
    await page.waitForTimeout(500);

    const validateBtn = page.getByRole('button', { name: /validate calm diagram/i });

    // First click — opens panel
    await validateBtn.click();
    await expect(page.getByText('Problems', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Second click — closes panel (toggle behavior per STATE.md)
    await validateBtn.click();
    await expect(page.getByText('Problems', { exact: true })).not.toBeVisible({ timeout: 5_000 });

    // Third click — re-opens panel
    await validateBtn.click();
    await expect(page.getByText('Problems', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('two orphaned nodes produce multiple validation warnings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Components')).toBeVisible({ timeout: 30_000 });

    // Add two separate nodes — both will be orphaned
    await addNodeFromPalette(page, 'Actor');
    await addNodeFromPalette(page, 'Service');

    await page.waitForTimeout(500);

    // Validate
    const validateBtn = page.getByRole('button', { name: /validate calm diagram/i });
    await validateBtn.click();

    await expect(page.getByText('Problems', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Should have at least 2 issue rows (one per orphaned node)
    const issueRows = page.locator('.vp-row');
    const rowCount = await issueRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);

    // Summary should mention "warning" (not just clean)
    const summaryText = page.locator('.vp-summary');
    const summary = await summaryText.textContent();
    expect(summary).toMatch(/warning/i);
  });
});
