import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeImageAssets, logoSvg, svgDataUrl } from '../test-support/fake-image-assets.js';
import { ExtensionLogo } from './ExtensionLogo.js';

const LIGHT = '/api/calm/extensions/svc/logo/light';
const DARK = '/api/calm/extensions/svc/logo/dark';
const lightSvg = logoSvg('#0f766e');
const darkSvg = logoSvg('#5eead4');

const setTheme = (theme: 'light' | 'dark') => document.documentElement.setAttribute('data-theme', theme);

afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
});

function renderLogo(logo: { light: string; dark?: string } | undefined, replies: Record<string, string | number> = {}) {
    const assets = fakeImageAssets(replies);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(assets.wrap(<ExtensionLogo extension={{ id: 'svc', logo }} size={20} />));
    return assets;
}

const box = () => screen.getByTestId('extension-logo');
const image = () => box().querySelector('img');
const marker = () => screen.queryByTestId('extension-marker');

/**
 * jsdom draws no image, so a test fires the load that a browser fires when it can draw the image. Until then the box
 * shows the marker, also for an image that loaded before.
 */
async function loadImage(src: string) {
    await waitFor(() => expect(image()).toHaveAttribute('src', src));
    expect(box()).toHaveAttribute('data-state', 'loading');
    expect(marker()).toBeVisible();
    expect(image()).not.toBeVisible();
    fireEvent.load(image()!);
    expect(box()).toHaveAttribute('data-state', 'loaded');
    expect(image()).toBeVisible();
    expect(marker()).not.toBeInTheDocument();
}

describe('ExtensionLogo', () => {
    it('is the marker of the extension, and reads nothing, when the manifest has no logo', () => {
        const { mock } = renderLogo(undefined);

        expect(marker()).toBeInTheDocument();
        expect(screen.queryByTestId('extension-logo')).not.toBeInTheDocument();
        expect(mock.history.get).toHaveLength(0);
    });

    it('shows the marker until the browser loads the image, then the light logo as a decorative image of the given size', async () => {
        setTheme('light');
        renderLogo({ light: 'logo.svg', dark: 'logo-dark.svg' }, { [LIGHT]: lightSvg, [DARK]: darkSvg });

        expect(box()).toHaveAttribute('data-state', 'loading');
        expect(marker()).toBeVisible();

        // The bytes are here, but the browser has not loaded the image yet.
        await waitFor(() => expect(image()).toHaveAttribute('src', svgDataUrl(lightSvg)));
        expect(box()).toHaveAttribute('data-state', 'loading');
        expect(marker()).toBeVisible();
        expect(image()).not.toBeVisible();

        fireEvent.load(image()!);

        expect(box()).toHaveAttribute('data-state', 'loaded');
        expect(image()).toBeVisible();
        expect(image()).toHaveAttribute('alt', '');
        expect(box()).toHaveAttribute('aria-hidden', 'true');
        expect(box()).toHaveStyle({ width: '20px', height: '20px' });
        expect(marker()).not.toBeInTheDocument();
    });

    it('shows the dark logo in the dark theme, with no plate', async () => {
        setTheme('dark');
        const { mock } = renderLogo({ light: 'logo.svg', dark: 'logo-dark.svg' }, { [LIGHT]: lightSvg, [DARK]: darkSvg });

        await loadImage(svgDataUrl(darkSvg));

        expect(box().style.backgroundColor).toBe('');
        expect(mock.history.get.map((request) => request.url)).toEqual([DARK]);
    });

    it('shows the light logo on a light plate in the dark theme when there is no dark logo, and no plate before it loads', async () => {
        setTheme('dark');
        renderLogo({ light: 'logo.svg' }, { [LIGHT]: lightSvg, [DARK]: darkSvg });
        await waitFor(() => expect(image()).toHaveAttribute('src', svgDataUrl(lightSvg)));
        expect(box().style.backgroundColor).toBe('');

        fireEvent.load(image()!);

        expect(box()).toHaveStyle({ backgroundColor: '#ffffff' });
    });

    it('shows the marker again until the logo of the new theme loads, and reads each variant once', async () => {
        setTheme('light');
        const { mock } = renderLogo({ light: 'logo.svg', dark: 'logo-dark.svg' }, { [LIGHT]: lightSvg, [DARK]: darkSvg });
        await loadImage(svgDataUrl(lightSvg));

        act(() => setTheme('dark'));
        await loadImage(svgDataUrl(darkSvg));

        act(() => setTheme('light'));
        await loadImage(svgDataUrl(lightSvg));
        expect(mock.history.get.map((request) => request.url)).toEqual([LIGHT, DARK]);
    });

    it('shows at once an image that the browser has complete already, such as a logo that the page drew before', async () => {
        setTheme('light');
        vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
        vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(24);
        renderLogo({ light: 'logo.svg' }, { [LIGHT]: lightSvg });

        await waitFor(() => expect(image()).toHaveAttribute('src', svgDataUrl(lightSvg)));

        expect(box()).toHaveAttribute('data-state', 'loaded');
        expect(image()).toBeVisible();
        expect(marker()).not.toBeInTheDocument();
    });

    it('falls back to the marker when the logo request fails', async () => {
        setTheme('light');
        renderLogo({ light: 'logo.svg' }, { [LIGHT]: 404 });

        await waitFor(() => expect(box()).toHaveAttribute('data-state', 'failed'));
        expect(marker()).toBeVisible();
        expect(image()).toBeNull();
    });

    it('keeps the marker when the browser cannot draw the image', async () => {
        setTheme('light');
        renderLogo({ light: 'logo.svg' }, { [LIGHT]: lightSvg });
        await waitFor(() => expect(image()).not.toBeNull());
        expect(marker()).toBeVisible();

        fireEvent.error(image()!);

        expect(box()).toHaveAttribute('data-state', 'failed');
        expect(marker()).toBeVisible();
        expect(image()).toBeNull();
    });

    it('falls back to the marker when the image of the new theme cannot be drawn, and shows the other logo again', async () => {
        setTheme('light');
        renderLogo({ light: 'logo.svg', dark: 'logo-dark.svg' }, { [LIGHT]: lightSvg, [DARK]: darkSvg });
        await loadImage(svgDataUrl(lightSvg));

        act(() => setTheme('dark'));
        await waitFor(() => expect(image()).toHaveAttribute('src', svgDataUrl(darkSvg)));
        fireEvent.error(image()!);
        expect(box()).toHaveAttribute('data-state', 'failed');
        expect(marker()).toBeVisible();

        act(() => setTheme('light'));
        await loadImage(svgDataUrl(lightSvg));
    });
});
