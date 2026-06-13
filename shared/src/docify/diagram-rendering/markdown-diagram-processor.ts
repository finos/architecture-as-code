import { readdir, readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import { mkdirp } from 'mkdirp';
import type { Logger } from '../../logger.js';
import type { DiagramExportFormat } from '../docifier.js';
import type { MermaidBrowserRenderer } from './mermaid-browser-renderer.js';

const MERMAID_BLOCK_REGEX = /```mermaid\n(.*?)\n```/gs;
const MARKDOWN_FILE_REGEX = /\.(md|mdx)$/i;

export interface DiagramFailure {
    file: string;
    index: number;
    error: string;
}

export interface DiagramProcessingSummary {
    filesScanned: number;
    diagramsFound: number;
    diagramsRendered: number;
    diagramsFailed: number;
    failures: DiagramFailure[];
}

type FileDiagramSummary = Omit<DiagramProcessingSummary, 'filesScanned'>;

/**
 * Renders every ```mermaid``` code block in a single markdown file via
 * renderer, and rewrites the file in place: rendered diagrams become a
 * centered `<p align="center"><img src="_diagrams/<basename>-<n>.<ext>"
 * alt="Diagram <n>" /></p>` reference, with the image written to a sibling
 * `_diagrams/` directory; failed diagrams are left as mermaid code blocks.
 * Files with no mermaid blocks are left untouched. `fileLabel` is used in
 * warnings/failure entries.
 */
async function processFile(
    mdFilePath: string,
    fileLabel: string,
    renderer: MermaidBrowserRenderer,
    logger: Logger
): Promise<FileDiagramSummary> {
    const summary: FileDiagramSummary = {
        diagramsFound: 0,
        diagramsRendered: 0,
        diagramsFailed: 0,
        failures: [],
    };

    const content = await readFile(mdFilePath, 'utf8');
    const matches = [...content.matchAll(MERMAID_BLOCK_REGEX)];
    if (matches.length === 0) {
        return summary;
    }
    summary.diagramsFound += matches.length;

    const baseName = path.basename(mdFilePath, path.extname(mdFilePath));
    const diagramsDir = path.join(path.dirname(mdFilePath), '_diagrams');

    let result = '';
    let lastIndex = 0;
    let diagramIndex = 0;

    for (const match of matches) {
        diagramIndex++;
        result += content.slice(lastIndex, match.index);

        try {
            const { data, extension } = await renderer.render(match[1]);
            const fileName = `${baseName}-${diagramIndex}.${extension}`;
            mkdirp.sync(diagramsDir);
            await writeFile(path.join(diagramsDir, fileName), data);
            result += `<p align="center">\n  <img src="_diagrams/${fileName}" alt="Diagram ${diagramIndex}" />\n</p>`;
            summary.diagramsRendered++;
        } catch (err) {
            result += match[0];
            const errorMessage = (err as Error).message;
            logger.warn(`⚠️ Failed to render mermaid diagram #${diagramIndex} in ${fileLabel}: ${errorMessage} — leaving as mermaid code block`);
            summary.diagramsFailed++;
            summary.failures.push({ file: fileLabel, index: diagramIndex, error: errorMessage });
        }

        lastIndex = match.index + match[0].length;
    }
    result += content.slice(lastIndex);

    await writeFile(mdFilePath, result, 'utf8');
    return summary;
}

/** Walks outputDir for .md/.mdx files and processes each one via processFile. */
export async function processDiagramsInDirectory(
    outputDir: string,
    renderer: MermaidBrowserRenderer,
    logger: Logger
): Promise<DiagramProcessingSummary> {
    const summary: DiagramProcessingSummary = {
        filesScanned: 0,
        diagramsFound: 0,
        diagramsRendered: 0,
        diagramsFailed: 0,
        failures: [],
    };

    const allFiles = await readdir(outputDir, { recursive: true });
    const markdownFiles = allFiles.filter((file) => MARKDOWN_FILE_REGEX.test(file));

    for (const relFile of markdownFiles) {
        summary.filesScanned++;
        const mdFilePath = path.join(outputDir, relFile);
        const fileSummary = await processFile(mdFilePath, relFile, renderer, logger);
        summary.diagramsFound += fileSummary.diagramsFound;
        summary.diagramsRendered += fileSummary.diagramsRendered;
        summary.diagramsFailed += fileSummary.diagramsFailed;
        summary.failures.push(...fileSummary.failures);
    }

    return summary;
}

/**
 * Processes a single markdown file in place, for docify invocations where
 * --output points directly at a .md/.mdx file (e.g. --template <file>.hbs
 * --output <file>.md) rather than a directory.
 */
export async function processDiagramsInFile(
    mdFilePath: string,
    renderer: MermaidBrowserRenderer,
    logger: Logger
): Promise<DiagramProcessingSummary> {
    const fileSummary = await processFile(mdFilePath, path.basename(mdFilePath), renderer, logger);
    return { filesScanned: 1, ...fileSummary };
}

/** Builds the final, user-facing summary line for a completed diagram export pass. */
export function formatDiagramSummary(
    summary: DiagramProcessingSummary,
    format: DiagramExportFormat,
    browserDisplayName: string,
    elapsedSeconds: string
): string {
    if (summary.diagramsFound === 0) {
        return 'ℹ️ No mermaid diagrams found to export.';
    }

    let message = `✅ Exported ${summary.diagramsRendered}/${summary.diagramsFound} diagrams to ${format.toUpperCase()} via ${browserDisplayName} in ${elapsedSeconds}s.`;
    if (summary.diagramsFailed > 0) {
        message += ` ${summary.diagramsFailed} left as mermaid code blocks — see warnings above.`;
    }
    return message;
}
