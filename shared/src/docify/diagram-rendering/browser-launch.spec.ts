import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import { chromium } from 'playwright-core';
import {
    launchBrowser,
    buildBrowserNotFoundMessage
} from './browser-launch.js';
import { BrowserLaunchError, BrowserOverrideError } from './errors.js';

vi.mock('fs');
vi.mock('playwright-core', () => ({
    chromium: {
        launch: vi.fn()
    }
}));

const mockBrowser = { close: vi.fn() } as unknown as Awaited<ReturnType<typeof chromium.launch>>;

describe('launchBrowser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('with --browser-path override', () => {
        it('launches via executablePath when the override path is a valid file', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
            vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

            const result = await launchBrowser({ browserPathOverride: '/opt/browsers/my-browser' });

            expect(chromium.launch).toHaveBeenCalledWith({ executablePath: '/opt/browsers/my-browser', headless: true });
            expect(result.browser).toBe(mockBrowser);
            expect(result.displayName).toBe('my-browser');
        });

        it('throws BrowserOverrideError without attempting a launch when the path does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await expect(launchBrowser({ browserPathOverride: '/does/not/exist' }))
                .rejects.toThrow(BrowserOverrideError);
            expect(chromium.launch).not.toHaveBeenCalled();
        });

        it('throws BrowserOverrideError without attempting a launch when the path is not a file', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => false } as fs.Stats);

            await expect(launchBrowser({ browserPathOverride: '/some/dir' }))
                .rejects.toThrow(BrowserOverrideError);
            expect(chromium.launch).not.toHaveBeenCalled();
        });

        it('throws BrowserOverrideError when launching the override path fails', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
            vi.mocked(chromium.launch).mockRejectedValue(new Error('boom'));

            await expect(launchBrowser({ browserPathOverride: '/opt/browsers/my-browser' }))
                .rejects.toThrow(/Failed to launch browser at '\/opt\/browsers\/my-browser': boom/);
        });
    });

    describe('without an override', () => {
        it('returns Google Chrome when the chrome channel launches successfully', async () => {
            vi.mocked(chromium.launch).mockResolvedValue(mockBrowser);

            const result = await launchBrowser();

            expect(chromium.launch).toHaveBeenCalledWith({ channel: 'chrome', headless: true });
            expect(result).toEqual({ browser: mockBrowser, displayName: 'Google Chrome' });
        });

        it('falls back to Microsoft Edge when the chrome channel fails', async () => {
            vi.mocked(chromium.launch)
                .mockRejectedValueOnce(new Error('chrome not found'))
                .mockResolvedValueOnce(mockBrowser);

            const result = await launchBrowser();

            expect(chromium.launch).toHaveBeenNthCalledWith(1, { channel: 'chrome', headless: true });
            expect(chromium.launch).toHaveBeenNthCalledWith(2, { channel: 'msedge', headless: true });
            expect(result).toEqual({ browser: mockBrowser, displayName: 'Microsoft Edge' });
        });

        it('throws BrowserLaunchError with the not-found diagnostic when both channels fail', async () => {
            vi.mocked(chromium.launch).mockRejectedValue(new Error('not found'));

            const error = await launchBrowser().catch(e => e);

            expect(error).toBeInstanceOf(BrowserLaunchError);
            expect(error.message).toBe(buildBrowserNotFoundMessage());
        });
    });
});

describe('buildBrowserNotFoundMessage', () => {
    it('explains automatic detection failed and gives manual discovery hints', () => {
        const message = buildBrowserNotFoundMessage();

        expect(message).toContain('No local Chromium-based browser found via automatic detection (tried Chrome, Edge).');
        expect(message).toContain('Locate a Chromium-based browser manually');
        expect(message).toContain('--browser-path');
        expect(message).toContain('Diagrams will remain as mermaid code blocks until a browser is available.');
    });
});
