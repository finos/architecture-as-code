import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processDiagramsInDirectory, processDiagramsInFile, formatDiagramSummary, DiagramProcessingSummary } from './markdown-diagram-processor.js';
import { DiagramRenderError } from './errors.js';
import type { MermaidBrowserRenderer } from './mermaid-browser-renderer.js';
import type { Logger } from '../../logger.js';

function createMockLogger(): Logger {
    return {
        log: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

function createMockRenderer(render: MermaidBrowserRenderer['render']): MermaidBrowserRenderer {
    return { render: vi.fn(render) } as unknown as MermaidBrowserRenderer;
}

describe('processDiagramsInDirectory', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docify-diagram-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('leaves files with no mermaid blocks untouched', async () => {
        const filePath = path.join(tempDir, 'plain.md');
        const original = '# Title\n\nNo diagrams here.\n';
        fs.writeFileSync(filePath, original);

        const renderer = createMockRenderer(vi.fn());
        const logger = createMockLogger();

        const summary = await processDiagramsInDirectory(tempDir, renderer, logger);

        expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
        expect(fs.existsSync(path.join(tempDir, '_diagrams'))).toBe(false);
        expect(summary).toEqual({
            filesScanned: 1,
            diagramsFound: 0,
            diagramsRendered: 0,
            diagramsFailed: 0,
            failures: [],
        });
        expect(renderer.render).not.toHaveBeenCalled();
    });

    it('renders a single mermaid diagram to SVG and rewrites the markdown', async () => {
        const filePath = path.join(tempDir, 'diagram.md');
        fs.writeFileSync(filePath, '# Title\n\n```mermaid\ngraph TD; A-->B\n```\n\nAfter.\n');

        const renderer = createMockRenderer(vi.fn().mockResolvedValue({ data: '<svg>diagram</svg>', extension: 'svg' }));
        const logger = createMockLogger();

        const summary = await processDiagramsInDirectory(tempDir, renderer, logger);

        const rewritten = fs.readFileSync(filePath, 'utf8');
        expect(rewritten).toContain('<p align="center">\n  <img src="_diagrams/diagram-1.svg" alt="Diagram 1" />\n</p>');
        expect(rewritten).not.toContain('```mermaid');
        expect(fs.readFileSync(path.join(tempDir, '_diagrams', 'diagram-1.svg'), 'utf8')).toBe('<svg>diagram</svg>');
        expect(renderer.render).toHaveBeenCalledWith('graph TD; A-->B');
        expect(summary).toEqual({
            filesScanned: 1,
            diagramsFound: 1,
            diagramsRendered: 1,
            diagramsFailed: 0,
            failures: [],
        });
    });

    it('writes PNG buffers as binary files', async () => {
        const filePath = path.join(tempDir, 'diagram.md');
        fs.writeFileSync(filePath, '```mermaid\ngraph TD; A-->B\n```\n');

        const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        const renderer = createMockRenderer(vi.fn().mockResolvedValue({ data: pngBuffer, extension: 'png' }));
        const logger = createMockLogger();

        await processDiagramsInDirectory(tempDir, renderer, logger);

        expect(fs.readFileSync(path.join(tempDir, '_diagrams', 'diagram-1.png'))).toEqual(pngBuffer);
        expect(fs.readFileSync(filePath, 'utf8')).toContain('<p align="center">\n  <img src="_diagrams/diagram-1.png" alt="Diagram 1" />\n</p>');
    });

    it('leaves a failed diagram as a mermaid code block, logs a warning, and continues with the rest', async () => {
        const filePath = path.join(tempDir, 'diagram.md');
        const original = '# Title\n\n```mermaid\ngraph TD; A-->B\n```\n\nMiddle.\n\n```mermaid\ngraph TD; C-->D\n```\n';
        fs.writeFileSync(filePath, original);

        const renderer = createMockRenderer(
            vi.fn()
                .mockRejectedValueOnce(new DiagramRenderError('Parse error on line 1'))
                .mockResolvedValueOnce({ data: '<svg>diagram-2</svg>', extension: 'svg' })
        );
        const logger = createMockLogger();

        const summary = await processDiagramsInDirectory(tempDir, renderer, logger);

        const rewritten = fs.readFileSync(filePath, 'utf8');
        expect(rewritten).toContain('```mermaid\ngraph TD; A-->B\n```');
        expect(rewritten).toContain('<p align="center">\n  <img src="_diagrams/diagram-2.svg" alt="Diagram 2" />\n</p>');
        expect(logger.warn).toHaveBeenCalledWith(
            '⚠️ Failed to render mermaid diagram #1 in diagram.md: Parse error on line 1 — leaving as mermaid code block'
        );
        expect(summary).toEqual({
            filesScanned: 1,
            diagramsFound: 2,
            diagramsRendered: 1,
            diagramsFailed: 1,
            failures: [{ file: 'diagram.md', index: 1, error: 'Parse error on line 1' }],
        });
    });

    it('handles markdown files in nested directories, writing _diagrams alongside each file', async () => {
        const nestedDir = path.join(tempDir, 'nested');
        fs.mkdirSync(nestedDir);
        const filePath = path.join(nestedDir, 'page.mdx');
        fs.writeFileSync(filePath, '```mermaid\ngraph TD; A-->B\n```\n');

        const renderer = createMockRenderer(vi.fn().mockResolvedValue({ data: '<svg>nested</svg>', extension: 'svg' }));
        const logger = createMockLogger();

        const summary = await processDiagramsInDirectory(tempDir, renderer, logger);

        expect(fs.readFileSync(path.join(nestedDir, '_diagrams', 'page-1.svg'), 'utf8')).toBe('<svg>nested</svg>');
        expect(fs.readFileSync(filePath, 'utf8')).toContain('<p align="center">\n  <img src="_diagrams/page-1.svg" alt="Diagram 1" />\n</p>');
        expect(summary.filesScanned).toBe(1);
    });

    it('scans multiple files and accumulates totals across them', async () => {
        fs.writeFileSync(path.join(tempDir, 'a.md'), '```mermaid\ngraph TD; A-->B\n```\n');
        fs.writeFileSync(path.join(tempDir, 'b.md'), '# No diagrams\n');

        const renderer = createMockRenderer(vi.fn().mockResolvedValue({ data: '<svg>a</svg>', extension: 'svg' }));
        const logger = createMockLogger();

        const summary = await processDiagramsInDirectory(tempDir, renderer, logger);

        expect(summary.filesScanned).toBe(2);
        expect(summary.diagramsFound).toBe(1);
        expect(summary.diagramsRendered).toBe(1);
    });
});

describe('processDiagramsInFile', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docify-diagram-'));
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('leaves a file with no mermaid blocks untouched', async () => {
        const filePath = path.join(tempDir, 'plain.md');
        const original = '# Title\n\nNo diagrams here.\n';
        fs.writeFileSync(filePath, original);

        const renderer = createMockRenderer(vi.fn());
        const logger = createMockLogger();

        const summary = await processDiagramsInFile(filePath, renderer, logger);

        expect(fs.readFileSync(filePath, 'utf8')).toBe(original);
        expect(fs.existsSync(path.join(tempDir, '_diagrams'))).toBe(false);
        expect(summary).toEqual({
            filesScanned: 1,
            diagramsFound: 0,
            diagramsRendered: 0,
            diagramsFailed: 0,
            failures: [],
        });
        expect(renderer.render).not.toHaveBeenCalled();
    });

    it('renders a single mermaid diagram and rewrites the file, ignoring sibling .md files', async () => {
        const filePath = path.join(tempDir, 'basic-structures_svg.md');
        fs.writeFileSync(filePath, '```mermaid\ngraph TD; A-->B\n```\n');

        // A sibling file in the same directory, produced by an earlier docify
        // invocation without --export-diagrams, should be left untouched.
        const siblingPath = path.join(tempDir, 'basic-structures.md');
        const siblingOriginal = '```mermaid\ngraph TD; A-->B\n```\n';
        fs.writeFileSync(siblingPath, siblingOriginal);

        const renderer = createMockRenderer(vi.fn().mockResolvedValue({ data: '<svg>diagram</svg>', extension: 'svg' }));
        const logger = createMockLogger();

        const summary = await processDiagramsInFile(filePath, renderer, logger);

        const rewritten = fs.readFileSync(filePath, 'utf8');
        expect(rewritten).toContain('<p align="center">\n  <img src="_diagrams/basic-structures_svg-1.svg" alt="Diagram 1" />\n</p>');
        expect(fs.readFileSync(path.join(tempDir, '_diagrams', 'basic-structures_svg-1.svg'), 'utf8')).toBe('<svg>diagram</svg>');
        expect(fs.readFileSync(siblingPath, 'utf8')).toBe(siblingOriginal);
        expect(summary).toEqual({
            filesScanned: 1,
            diagramsFound: 1,
            diagramsRendered: 1,
            diagramsFailed: 0,
            failures: [],
        });
    });

    it('leaves a failed diagram as a mermaid code block and records the failure', async () => {
        const filePath = path.join(tempDir, 'diagram.md');
        fs.writeFileSync(filePath, '```mermaid\ngraph TD; A-->B\n```\n');

        const renderer = createMockRenderer(vi.fn().mockRejectedValue(new DiagramRenderError('Parse error on line 1')));
        const logger = createMockLogger();

        const summary = await processDiagramsInFile(filePath, renderer, logger);

        expect(fs.readFileSync(filePath, 'utf8')).toContain('```mermaid');
        expect(logger.warn).toHaveBeenCalledWith(
            '⚠️ Failed to render mermaid diagram #1 in diagram.md: Parse error on line 1 — leaving as mermaid code block'
        );
        expect(summary).toEqual({
            filesScanned: 1,
            diagramsFound: 1,
            diagramsRendered: 0,
            diagramsFailed: 1,
            failures: [{ file: 'diagram.md', index: 1, error: 'Parse error on line 1' }],
        });
    });
});

describe('formatDiagramSummary', () => {
    const baseSummary: DiagramProcessingSummary = {
        filesScanned: 1,
        diagramsFound: 0,
        diagramsRendered: 0,
        diagramsFailed: 0,
        failures: [],
    };

    it('reports "no diagrams found" when none were present', () => {
        expect(formatDiagramSummary(baseSummary, 'svg', 'Google Chrome', '1.0')).toBe('ℹ️ No mermaid diagrams found to export.');
    });

    it('reports full success with elapsed time', () => {
        const summary = { ...baseSummary, diagramsFound: 15, diagramsRendered: 15 };
        expect(formatDiagramSummary(summary, 'svg', 'Google Chrome', '12.4')).toBe(
            '✅ Exported 15/15 diagrams to SVG via Google Chrome in 12.4s.'
        );
    });

    it('reports partial success and points to warnings', () => {
        const summary = { ...baseSummary, diagramsFound: 15, diagramsRendered: 12, diagramsFailed: 3 };
        expect(formatDiagramSummary(summary, 'png', 'Microsoft Edge', '11.1')).toBe(
            '✅ Exported 12/15 diagrams to PNG via Microsoft Edge in 11.1s. 3 left as mermaid code blocks — see warnings above.'
        );
    });
});
