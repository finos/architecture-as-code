import { describe, it, afterEach, expect } from 'vitest';
import { readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { Docifier } from './docifier.js';
import { launchBrowser, LaunchedBrowser } from './diagram-rendering/browser-launch.js';

const INPUT_DIR = join(
    __dirname,
    '../../test_fixtures/command/generate/expected-output'
);

const OUTPUT_DIR = join(
    __dirname,
    '../../test_fixtures/docify/diagram-export/actual-output'
);

const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let detectedBrowser: LaunchedBrowser | undefined;
try {
    detectedBrowser = await launchBrowser();
} catch {
    // No local Chromium-based browser available - suite is skipped below.
} finally {
    await detectedBrowser?.browser.close();
}

const maybeDescribe = detectedBrowser ? describe : describe.skip;

maybeDescribe('Docifier E2E - --export-diagrams (local browser)', () => {
    afterEach(() => {
        rmSync(OUTPUT_DIR, { recursive: true, force: true });
    });

    it('renders mermaid diagrams to SVG files and rewrites markdown references', async () => {
        const docifier = new Docifier(
            'WEBSITE',
            join(INPUT_DIR, 'conference-signup.arch.json'),
            OUTPUT_DIR,
            undefined,
            'bundle',
            undefined,
            false,
            false,
            'svg'
        );

        await docifier.docify();

        const indexMd = readFileSync(join(OUTPUT_DIR, 'docs/index.md'), 'utf8');
        expect(indexMd).not.toContain('```mermaid');
        expect(indexMd).toContain('<p align="center">\n  <img src="_diagrams/index-1.svg" alt="Diagram 1" />\n</p>');

        const svg = readFileSync(join(OUTPUT_DIR, 'docs/_diagrams/index-1.svg'), 'utf8');
        expect(svg).toContain('<svg');
        expect(svg).toContain('viewBox');
    }, 60_000);

    it('renders mermaid diagrams to PNG files and rewrites markdown references', async () => {
        const docifier = new Docifier(
            'WEBSITE',
            join(INPUT_DIR, 'conference-signup.arch.json'),
            OUTPUT_DIR,
            undefined,
            'bundle',
            undefined,
            false,
            false,
            'png'
        );

        await docifier.docify();

        const indexMd = readFileSync(join(OUTPUT_DIR, 'docs/index.md'), 'utf8');
        expect(indexMd).not.toContain('```mermaid');
        expect(indexMd).toContain('<p align="center">\n  <img src="_diagrams/index-1.png" alt="Diagram 1" />\n</p>');

        const png = readFileSync(join(OUTPUT_DIR, 'docs/_diagrams/index-1.png'));
        expect(png.subarray(0, PNG_MAGIC_BYTES.length)).toEqual(PNG_MAGIC_BYTES);
    }, 60_000);
});
