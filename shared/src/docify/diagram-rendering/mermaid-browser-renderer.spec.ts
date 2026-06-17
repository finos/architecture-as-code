import * as http from 'http';
import { describe, it, expect, vi } from 'vitest';
import type { Browser, Page } from 'playwright-core';
import { MermaidBrowserRenderer } from './mermaid-browser-renderer.js';
import { BrowserLaunchError, DiagramRenderError } from './errors.js';
import { initLogger } from '../../logger.js';

const logger = initLogger(false, 'mermaid-browser-renderer.spec');

interface MockPage {
    goto: ReturnType<typeof vi.fn>;
    waitForFunction: ReturnType<typeof vi.fn>;
    evaluate: ReturnType<typeof vi.fn>;
    locator: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
}

function createMockPage(overrides: Partial<MockPage> = {}): MockPage {
    return {
        goto: vi.fn().mockResolvedValue(undefined),
        waitForFunction: vi.fn().mockResolvedValue(undefined),
        evaluate: vi.fn().mockResolvedValue('<svg>diagram</svg>'),
        locator: vi.fn().mockReturnValue({ screenshot: vi.fn().mockResolvedValue(Buffer.from('png')) }),
        close: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createMockBrowser(page: MockPage): { browser: Browser; close: ReturnType<typeof vi.fn> } {
    const close = vi.fn().mockResolvedValue(undefined);
    const browser = {
        newPage: vi.fn().mockResolvedValue(page as unknown as Page),
        close,
    } as unknown as Browser;
    return { browser, close };
}

describe('MermaidBrowserRenderer', () => {
    describe('start', () => {
        it('opens a page, navigates to the local asset server, and waits for mermaid readiness', async () => {
            const page = createMockPage();
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });

            await renderer.start();

            expect(browser.newPage).toHaveBeenCalled();
            expect(page.goto).toHaveBeenCalledWith(expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/$/));
            expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });

            await renderer.dispose();
        });

        it('disposes and throws BrowserLaunchError when mermaid never becomes ready', async () => {
            const page = createMockPage({
                waitForFunction: vi.fn().mockRejectedValue(new Error('timeout waiting for window.__mermaidReady')),
            });
            const { browser, close } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });

            await expect(renderer.start()).rejects.toThrow(BrowserLaunchError);
            expect(page.close).toHaveBeenCalled();
            expect(close).toHaveBeenCalled();
        });
    });

    describe('render', () => {
        it('throws DiagramRenderError when called before start()', async () => {
            const page = createMockPage();
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });

            await expect(renderer.render('graph TD; A-->B')).rejects.toThrow(DiagramRenderError);
        });

        it('returns SVG markup for format "svg"', async () => {
            const page = createMockPage({ evaluate: vi.fn().mockResolvedValue('<svg>diagram</svg>') });
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });
            await renderer.start();

            const result = await renderer.render('graph TD; A-->B');

            expect(result).toEqual({ data: '<svg>diagram</svg>', extension: 'svg' });
            expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), 'graph TD; A-->B');

            await renderer.dispose();
        });

        it('returns PNG bytes for format "png"', async () => {
            const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
            const screenshot = vi.fn().mockResolvedValue(pngBuffer);
            const page = createMockPage({
                evaluate: vi.fn().mockResolvedValue('<svg>diagram</svg>'),
                locator: vi.fn().mockReturnValue({ screenshot }),
            });
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'png', logger });
            await renderer.start();

            const result = await renderer.render('graph TD; A-->B');

            expect(result).toEqual({ data: pngBuffer, extension: 'png' });
            expect(page.locator).toHaveBeenCalledWith('#diagram-container svg');
            expect(screenshot).toHaveBeenCalledWith({ type: 'png' });

            await renderer.dispose();
        });

        it('wraps a rejected evaluate (e.g. mermaid syntax error) in DiagramRenderError', async () => {
            const page = createMockPage({ evaluate: vi.fn().mockRejectedValue(new Error('Parse error on line 1')) });
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });
            await renderer.start();

            await expect(renderer.render('not mermaid')).rejects.toThrow(DiagramRenderError);
            await expect(renderer.render('not mermaid')).rejects.toThrow('Parse error on line 1');

            await renderer.dispose();
        });

        it('throws DiagramRenderError when rendering exceeds renderTimeoutMs', async () => {
            const page = createMockPage({ evaluate: vi.fn().mockReturnValue(new Promise(() => { /* never resolves */ })) });
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', renderTimeoutMs: 50, logger });
            await renderer.start();

            await expect(renderer.render('graph TD; A-->B')).rejects.toThrow(/render timed out after 50ms/);

            await renderer.dispose();
        });
    });

    describe('dispose', () => {
        it('is safe to call before start(), and idempotent afterwards', async () => {
            const page = createMockPage();
            const { browser, close } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });

            await expect(renderer.dispose()).resolves.toBeUndefined();
            expect(close).toHaveBeenCalledTimes(1);

            await renderer.start();
            await renderer.dispose();
            await renderer.dispose();

            expect(close).toHaveBeenCalledTimes(3);
        });

        it('logs at debug level and continues when page.close() rejects', async () => {
            const page = createMockPage({ close: vi.fn().mockRejectedValue(new Error('already closed')) });
            const { browser, close } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });
            await renderer.start();

            await expect(renderer.dispose()).resolves.toBeUndefined();
            expect(close).toHaveBeenCalled();
        });
    });

    describe('asset server', () => {
        it('serves the bootstrap page, mermaid/elk bundles, 404s unknown paths, and blocks path traversal', async () => {
            const page = createMockPage();
            const { browser } = createMockBrowser(page);
            const renderer = new MermaidBrowserRenderer({ browser, format: 'svg', logger });
            await renderer.start();

            const baseUrl = page.goto.mock.calls[0][0] as string;

            const indexRes = await fetch(baseUrl);
            expect(indexRes.status).toBe(200);
            expect(indexRes.headers.get('content-type')).toBe('text/html');
            expect(await indexRes.text()).toContain('window.renderMermaid');

            const mermaidRes = await fetch(`${baseUrl}mermaid/mermaid.esm.min.mjs`);
            expect(mermaidRes.status).toBe(200);
            expect(mermaidRes.headers.get('content-type')).toBe('text/javascript');

            const elkRes = await fetch(`${baseUrl}elk/mermaid-layout-elk.esm.min.mjs`);
            expect(elkRes.status).toBe(200);
            expect(elkRes.headers.get('content-type')).toBe('text/javascript');

            const missingRes = await fetch(`${baseUrl}mermaid/does-not-exist.mjs`);
            expect(missingRes.status).toBe(404);

            const otherRes = await fetch(`${baseUrl}unknown/path`);
            expect(otherRes.status).toBe(404);

            const port = new URL(baseUrl).port;
            const traversalStatus = await new Promise<number>((resolve, reject) => {
                http.get(
                    { host: '127.0.0.1', port, path: '/mermaid/%2e%2e%2f%2e%2e%2f%2e%2e%2fpackage.json' },
                    (res) => {
                        resolve(res.statusCode ?? 0);
                        res.resume();
                    }
                ).on('error', reject);
            });
            expect(traversalStatus).toBe(403);

            await renderer.dispose();
        });
    });
});
