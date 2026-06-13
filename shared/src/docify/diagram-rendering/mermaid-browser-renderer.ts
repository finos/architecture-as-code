import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { createRequire } from 'module';
import type { AddressInfo } from 'net';
import type { Browser, Page } from 'playwright-core';
import type { Logger } from '../../logger.js';
import type { DiagramExportFormat } from '../docifier.js';
import { BrowserLaunchError, DiagramRenderError } from './errors.js';

// `import.meta.url` is only valid when this module runs as real ESM (e.g. shared's
// own dist, or vitest). When bundled to CJS by a consumer (cli, calm-server, the
// VSCode extension), `import.meta` is replaced with `{}` and `__filename` is the
// native CJS global instead - so prefer that when it's defined.
const require = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);

const DEFAULT_RENDER_TIMEOUT_MS = 30_000;
const PAGE_READY_TIMEOUT_MS = 30_000;

const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.mjs': 'text/javascript',
    '.js': 'text/javascript',
    '.map': 'application/json',
};

interface MermaidRenderWindow {
    __mermaidReady?: boolean;
    renderMermaid?: (code: string) => Promise<string>;
}

export interface MermaidBrowserRendererOptions {
    /** Already-launched browser (from launchBrowser); caller owns its lifecycle. */
    browser: Browser;
    format: DiagramExportFormat;
    /** Per-diagram render timeout, in milliseconds. Defaults to 30000. */
    renderTimeoutMs?: number;
    logger: Logger;
}

export interface MermaidRenderResult {
    /** SVG markup for format 'svg', PNG bytes for format 'png'. */
    data: string | Buffer;
    extension: 'svg' | 'png';
}

// calm-widgets-generated diagrams set this exact font stack as their mermaid
// themeVariables.fontFamily, to match the IDE's UI font - but mermaid's "base"
// theme (with flowchart.htmlLabels: false) never actually applies
// themeVariables.fontFamily to anything: it's recorded in a --mermaid-font-family
// custom property scoped to a selector that can never match, so it's dead CSS.
// Live in an IDE webview, text still ends up in this font because <text>/tspan
// inherit font-family from the page body, which the IDE sets to the same stack.
// Setting it on the page body here, before mermaid.render() runs, reproduces
// that inheritance so mermaid measures/lays out node and label sizes using it;
// applying the same value to the exported svg's own style keeps a
// standalone-viewed export visually consistent with that layout - using a
// different font post-hoc would shift text widths and clip labels.
const DIAGRAM_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, \'Segoe WPC\', \'Segoe UI\', system-ui, \'Ubuntu\', sans-serif';

const BOOTSTRAP_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{margin:0;font-family:${DIAGRAM_FONT_FAMILY};}</style>
</head>
<body>
<div id="diagram-container"></div>
<script type="module">
  import mermaid from './mermaid/mermaid.esm.min.mjs';
  import elkLayouts from './elk/mermaid-layout-elk.esm.min.mjs';
  mermaid.registerLayoutLoaders(elkLayouts);
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'base',
    deterministicIds: true, logLevel: 'error',
    maxTextSize: 2000000, maxEdges: 10000
  });
  window.renderMermaid = async (code) => {
    const container = document.getElementById('diagram-container');
    container.innerHTML = '';
    const { svg } = await mermaid.render('diagram-' + Math.random().toString(36).slice(2), code);
    container.innerHTML = svg;

    // 'click' directives wrap nodes in <a xlink:href="..." transform="..."> for
    // in-page navigation when mermaid is rendered live - the transform that
    // positions the node lives on this <a>, not on the inner <g class="node">.
    // That link target is meaningless once the SVG is written to a standalone
    // file, and mermaid's output doesn't declare the xlink namespace it uses -
    // making the file invalid XML and unrenderable as an <img>. Replace each <a>
    // with a <g> carrying over its non-link attributes (so positioning is kept),
    // then re-serialize via XMLSerializer so the result is guaranteed well-formed
    // XML regardless of what mermaid produced (e.g. unclosed <br> tags or HTML
    // entities in multi-line labels).
    const svgEl = container.querySelector('svg');
    svgEl.querySelectorAll('a').forEach((a) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      for (const attr of Array.from(a.attributes)) {
        if (attr.name === 'xlink:href' || attr.name === 'href' || attr.name === 'target') continue;
        g.setAttribute(attr.name, attr.value);
      }
      while (a.firstChild) g.appendChild(a.firstChild);
      a.replaceWith(g);
    });
    svgEl.removeAttribute('xmlns');

    // Mermaid sizes its root <svg> with width="100%" and no height, relying on the
    // page's layout to constrain it via the accompanying "max-width" style. As a
    // standalone file referenced via <img>, that gives the SVG no definite
    // intrinsic size, so it renders hugely oversized. Give it explicit width/height
    // from its viewBox so it displays at its intended size when embedded.
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const [, , width, height] = viewBox.split(/[\\s,]+/);
      svgEl.setAttribute('width', width);
      svgEl.setAttribute('height', height);
    }

    // Match the font used for layout (set on body, above) so a standalone
    // export isn't measured in one font and displayed in another.
    svgEl.style.fontFamily = ${JSON.stringify(DIAGRAM_FONT_FAMILY)};

    return new XMLSerializer().serializeToString(svgEl);
  };
  window.__mermaidReady = true;
</script>
</body></html>`;

/**
 * Renders mermaid diagrams to SVG or PNG using an already-launched local
 * Chromium-family browser. Serves mermaid + @mermaid-js/layout-elk's ESM
 * bundles from an ephemeral local HTTP server, navigates a page to it, and
 * runs mermaid.render() in-page for each diagram.
 */
export class MermaidBrowserRenderer {
    private readonly mermaidDist = path.dirname(require.resolve('mermaid/package.json')) + '/dist';
    private readonly elkDist = path.dirname(require.resolve('@mermaid-js/layout-elk/package.json')) + '/dist';

    private server?: http.Server;
    private page?: Page;

    constructor(private readonly options: MermaidBrowserRendererOptions) {}

    /** Starts the local asset server, opens a page, and waits until mermaid is ready. */
    async start(): Promise<void> {
        this.server = await this.startAssetServer();
        const { port } = this.server.address() as AddressInfo;

        try {
            this.page = await this.options.browser.newPage();
            await this.page.goto(`http://127.0.0.1:${port}/`);
            await this.page.waitForFunction(
                () => (window as unknown as MermaidRenderWindow).__mermaidReady === true,
                { timeout: PAGE_READY_TIMEOUT_MS }
            );
        } catch (err) {
            await this.dispose();
            throw new BrowserLaunchError(`Failed to initialize the mermaid renderer: ${(err as Error).message}`);
        }
    }

    /** Renders a single mermaid diagram. Throws DiagramRenderError on invalid syntax or timeout. */
    async render(mermaidSource: string): Promise<MermaidRenderResult> {
        if (!this.page) {
            throw new DiagramRenderError('MermaidBrowserRenderer.render() called before start()');
        }
        const timeoutMs = this.options.renderTimeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
        const page = this.page;

        try {
            const svg = await this.withTimeout(
                page.evaluate(
                    (code) => (window as unknown as MermaidRenderWindow).renderMermaid!(code),
                    mermaidSource
                ),
                timeoutMs
            );

            if (this.options.format === 'svg') {
                return { data: svg, extension: 'svg' };
            }

            const buffer = await this.withTimeout(
                page.locator('#diagram-container svg').screenshot({ type: 'png' }),
                timeoutMs
            );
            return { data: buffer, extension: 'png' };
        } catch (err) {
            throw new DiagramRenderError((err as Error).message, err as Error);
        }
    }

    /** Closes the page and asset server, and the browser itself. Safe to call multiple times. */
    async dispose(): Promise<void> {
        try {
            await this.page?.close();
        } catch (err) {
            this.options.logger.debug(`Error closing diagram render page: ${(err as Error).message}`);
        }
        this.page = undefined;

        try {
            await this.options.browser.close();
        } catch (err) {
            this.options.logger.debug(`Error closing diagram render browser: ${(err as Error).message}`);
        }

        try {
            this.server?.close();
        } catch (err) {
            this.options.logger.debug(`Error closing diagram render asset server: ${(err as Error).message}`);
        }
        this.server = undefined;
    }

    private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        let timer: NodeJS.Timeout;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`render timed out after ${timeoutMs}ms`)), timeoutMs);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }

    private async startAssetServer(): Promise<http.Server> {
        const server = http.createServer((req, res) => this.handleRequest(req, res));
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        return server;
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        const url = req.url ?? '/';

        if (url === '/' || url === '/index.html') {
            res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
            res.end(BOOTSTRAP_HTML);
            return;
        }

        if (url.startsWith('/mermaid/')) {
            this.serveStatic(res, this.mermaidDist, url.slice('/mermaid/'.length));
            return;
        }

        if (url.startsWith('/elk/')) {
            this.serveStatic(res, this.elkDist, url.slice('/elk/'.length));
            return;
        }

        res.writeHead(404);
        res.end();
    }

    private serveStatic(res: http.ServerResponse, rootDir: string, relativePath: string): void {
        let decoded: string;
        try {
            decoded = decodeURIComponent(relativePath);
        } catch {
            res.writeHead(400);
            res.end();
            return;
        }

        const resolved = path.resolve(rootDir, decoded);
        if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
            res.writeHead(403);
            res.end();
            return;
        }

        fs.readFile(resolved, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end();
                return;
            }
            const ext = path.extname(resolved);
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
            res.end(data);
        });
    }
}
