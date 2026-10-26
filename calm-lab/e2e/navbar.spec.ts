import { expect, test, type Locator } from '@playwright/test';

async function box(locator: Locator) {
    const rect = await locator.boundingBox();
    if (!rect) throw new Error(`${locator} is not visible`);
    return rect;
}

// #3205: on phones the "CALM" title ran under the links, "CALM Hub" wrapped and the toggle shrank.
// 360px is the most common Android width, and the navbar has the least free space there.
for (const width of [320, 360, 375, 414]) {
    test(`the navbar fits on one row at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/');
        const navbar = page.getByRole('banner');
        const docsLink = navbar.getByRole('link', { name: 'Docs' });
        // React renders after `load`, and the navbar text is what requests the web fonts.
        await expect(docsLink).toBeVisible();
        // The fallback fonts are wider, so without the web fonts this measures a different navbar.
        await page.evaluate(async () => {
            await document.fonts.ready;
        });
        const plexLoaded = await page.evaluate(() =>
            [...document.fonts].some((font) => font.family === 'IBM Plex Sans' && font.status === 'loaded'),
        );
        expect(plexLoaded, 'IBM Plex Sans loaded from Google Fonts').toBe(true);

        expect(await navbar.evaluate((el) => el.scrollWidth - el.clientWidth), 'navbar overflow').toBe(0);

        const docs = await box(docsLink);
        const title = navbar.getByText('CALM', { exact: true });
        // Below 360px the CSS hides the title. `toBeHidden` also passes when nothing matches, so count it.
        await expect(title).toHaveCount(1);
        if (width >= 360) {
            await expect(title).toBeVisible();
            const titleBox = await box(title);
            expect(titleBox.x + titleBox.width, 'title right edge').toBeLessThanOrEqual(docs.x);
        } else {
            await expect(title).toBeHidden();
        }

        const hub = await box(navbar.getByRole('link', { name: 'CALM Hub' }));
        expect(hub.height, '"CALM Hub" height, the same as one-line "Docs"').toBe(docs.height);

        const toggle = await box(navbar.getByRole('button', { name: /dark and light mode/ }));
        expect(toggle.width, 'toggle width').toBe(32);
        expect(toggle.x + toggle.width, 'toggle right edge').toBeLessThanOrEqual(width);
    });
}
