import * as fs from 'fs';
import * as path from 'path';
import type { Browser } from 'playwright-core';
import { BrowserLaunchError, BrowserOverrideError } from './errors.js';

export interface BrowserLaunchOptions {
    /** Path to a Chromium-based browser executable, from --browser-path. */
    browserPathOverride?: string;
}

export interface LaunchedBrowser {
    /** Caller owns the lifecycle and must close this browser. */
    browser: Browser;
    /** e.g. "Google Chrome", "Microsoft Edge", or the basename of an override path. */
    displayName: string;
}

const MANUAL_DISCOVERY_HINTS =
`Locate a Chromium-based browser manually:
  macOS:   right-click the app in Finder > "Show Package Contents" >
           Contents/MacOS/<AppName>
  Windows: right-click the browser's shortcut > Properties > check the
           "Target" field
  Linux:   run \`which google-chrome\`, \`which chromium\`,
           \`which brave-browser\`, etc.`;

/** Builds the full diagnostic message for the "no browser found" case. */
export function buildBrowserNotFoundMessage(): string {
    return 'No local Chromium-based browser found via automatic detection (tried Chrome, Edge).\n\n' +
        `${MANUAL_DISCOVERY_HINTS}\n\n` +
        'Pass its path via --browser-path. Diagrams will remain as mermaid code blocks until a browser is available.';
}

/**
 * Launches a local Chromium-family browser.
 *
 * - If browserPathOverride is set: validates it exists, launches via
 *   executablePath. Throws BrowserOverrideError (fatal) if missing or
 *   if the launch fails.
 * - Otherwise: tries chromium.launch({channel:'chrome'}) then
 *   {channel:'msedge'}. Throws BrowserLaunchError (recoverable, message
 *   from buildBrowserNotFoundMessage()) if both fail. Failed channel
 *   launches fail fast (playwright checks the path before spawning), so
 *   trying both candidates costs negligible time when neither is present.
 */
export async function launchBrowser(options?: BrowserLaunchOptions): Promise<LaunchedBrowser> {
    // Loaded lazily so that consumers which never set --export-diagrams (e.g. the
    // VSCode extension) never require playwright-core at module-load time.
    const { chromium } = await import('playwright-core');

    const override = options?.browserPathOverride;
    if (override) {
        if (!fs.existsSync(override) || !fs.statSync(override).isFile()) {
            throw new BrowserOverrideError(`--browser-path '${override}' does not exist or is not a file.`);
        }
        try {
            const browser = await chromium.launch({ executablePath: override, headless: true });
            return { browser, displayName: path.basename(override) };
        } catch (err) {
            throw new BrowserOverrideError(`Failed to launch browser at '${override}': ${(err as Error).message}`);
        }
    }

    const candidates = [
        { channel: 'chrome' as const, displayName: 'Google Chrome' },
        { channel: 'msedge' as const, displayName: 'Microsoft Edge' },
    ];
    for (const { channel, displayName } of candidates) {
        try {
            const browser = await chromium.launch({ channel, headless: true });
            return { browser, displayName };
        } catch {
            // try next candidate
        }
    }

    throw new BrowserLaunchError(buildBrowserNotFoundMessage());
}
