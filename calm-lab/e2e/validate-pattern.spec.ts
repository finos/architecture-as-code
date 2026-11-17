import { expect, test } from '@playwright/test';

// Spectral compiles some JSONPath rules from the source of a function. The minifier changed that
// source and broke `calm validate -p`, which unit tests cannot see because they run unminified.
test('calm validate -p runs in the production build', async ({ page }) => {
    await page.goto('/?lesson=intermediate-17');
    await page.getByRole('button', { name: /Write the pattern/ }).click();
    await page.getByRole('button', { name: 'Show hint' }).first().click();
    const pattern = await page.locator('pre').filter({ hasText: '"prefixItems"' }).first().innerText();

    await page.getByLabel('File').selectOption('/workspace/patterns/web-app-pattern.json');
    await page.getByRole('textbox', { name: /Edit patterns/ }).fill(pattern);
    await page.getByRole('button', { name: /^Save/ }).click();

    const terminal = page.getByLabel('Terminal input');
    const run = async (command: string) => {
        await terminal.fill(command);
        await terminal.press('Enter');
    };
    await run('calm generate -p patterns/web-app-pattern.json -o architectures/generated-webapp.json');
    await expect(page.getByText('Successfully generated architecture')).toBeVisible();
    await run('calm validate -p patterns/web-app-pattern.json -a architectures/generated-webapp.json -f pretty');

    await expect(page.getByText('Errors: no (0)')).toBeVisible();
    await expect(page.getByText(/^error: /)).toHaveCount(0);
});
