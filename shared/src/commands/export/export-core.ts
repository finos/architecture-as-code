// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import path from 'path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type { Logger } from '../../logger.js';

export interface ArchiveWriter {
    on(event: 'error', listener: (error: Error) => void): unknown;
    pipe(destination: NodeJS.WritableStream): unknown;
    append(data: Buffer | string, options: { name: string }): unknown;
    finalize(): Promise<void> | void;
}

export interface ExportCommandOptions {
    /** Path to a project directory or an index.md entry point. */
    entryPath: string;
    /** Path at which to write the resulting zip archive. */
    outputPath: string;
    verbose: boolean;
}

/** Simple interface for creating ZIP archives without requiring the archiver package. */
export interface SimpleZipArchive {
    /** Add a file to the archive. */
    append(data: Buffer | string, options: { name: string }): void;
    /** Finalize the archive and write it to the output stream. */
    finalize(): Promise<void>;
}

export interface ManifestFileEntry {
    path: string;
    sha256: string;
    size: number;
}

export interface ExportManifest {
    generatedAt: string;
    entryPoint: string;
    fileCount: number;
    files: ManifestFileEntry[];
}

const REFERENCE_EXTENSIONS = /\.(json|md)$/i;

function isRemoteOrAnchorReference(target: string): boolean {
    return !target
        || target.startsWith('#')
        || target.startsWith('mailto:')
        || target.startsWith('//')
        || /^[a-z][a-z0-9+.-]*:\/\//i.test(target);
}

function addMarkdownFileReference(refs: string[], value: string): void {
    const reference = value.trim().replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '').trim();
    if (reference && !isRemoteOrAnchorReference(reference)) {
        refs.push(reference);
    }
}

/** Extracts declared artifact files from front matter and local targets from Markdown links/images. */
export function extractMarkdownReferences(content: string): string[] {
    const refs: string[] = [];

    const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontMatterMatch) {
        let listKey: string | undefined;
        for (const line of frontMatterMatch[1].split('\n')) {
            if (/^\s*#/.test(line) || !line.trim()) {
                continue;
            }

            const listPath = line.match(/^\s*(?:-\s*)?path:\s*(.+?)\s*$/);
            if (listPath) {
                addMarkdownFileReference(refs, listPath[1]);
                continue;
            }

            const keyValue = line.match(/^\s*([\w-]+):\s*(.*?)\s*$/);
            if (keyValue) {
                listKey = keyValue[1];
                if (listKey === 'calm-file' && keyValue[2]) {
                    keyValue[2].split(',').forEach((value) => addMarkdownFileReference(refs, value));
                }
                continue;
            }

            const listValue = line.match(/^\s*-\s*(.+?)\s*$/);
            if (listKey === 'calm-file' && listValue) {
                addMarkdownFileReference(refs, listValue[1]);
            }
        }
    }

    const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
        const target = match[1].trim().split(/\s+/)[0];
        if (!isRemoteOrAnchorReference(target)) {
            refs.push(target);
        }
    }

    return refs;
}

/** Recursively walks a parsed CALM JSON document, collecting string values that look like local .json/.md references. */
export function extractJsonReferences(node: unknown, refs: string[] = []): string[] {
    if (typeof node === 'string') {
        if (REFERENCE_EXTENSIONS.test(node) && !isRemoteOrAnchorReference(node)) {
            refs.push(node);
        }
    } else if (Array.isArray(node)) {
        node.forEach((child) => extractJsonReferences(child, refs));
    } else if (node && typeof node === 'object') {
        for (const value of Object.values(node as Record<string, unknown>)) {
            extractJsonReferences(value, refs);
        }
    }
    return refs;
}

/** Same-named `.md` companion doc for a building-block/architecture CALM JSON file, if one exists. */
function companionMarkdownFor(jsonFilePath: string): string | undefined {
    const companion = jsonFilePath.replace(/\.json$/i, '.md');
    return fs.existsSync(companion) ? companion : undefined;
}

export interface DiscoveryResult {
    /** Absolute paths of every discovered file. */
    files: string[];
    /** In-memory content for generated files that do not exist on disk. */
    generated?: Map<string, Buffer>;
}

/**
 * Starting from `index.md`, recursively discovers every local
 * file reachable through Markdown links/front matter, CALM JSON string references
 * (e.g. `details.building-block`), guarding against circular references.
 *
 * Security: Rejects absolute references and paths escaping the project root
 * to prevent arbitrary file disclosure when exporting untrusted OKF files.
 */
export function discoverDependencies(entryPath: string, logger?: Logger): DiscoveryResult {
    // Security: Resolve project root to handle symlinks (e.g., /tmp -> /private/tmp on macOS)
    const projectRoot = fs.realpathSync(path.resolve(path.dirname(entryPath)));
    const visited = new Set<string>();
    const queue: Array<{ filePath: string; referencedFrom?: string }> = [{ filePath: path.resolve(entryPath) }];

    function isWithinProjectRoot(filePath: string): boolean {
        // For existing files, resolve symlinks; for non-existent paths, normalize
        let resolved: string;
        try {
            resolved = fs.realpathSync(filePath);
        } catch {
            resolved = path.normalize(filePath);
        }
        return resolved === projectRoot || resolved.startsWith(projectRoot + path.sep);
    }

    while (queue.length > 0) {
        const item = queue.shift();
        const current = item?.filePath;
        if (!current || visited.has(current)) {
            continue;
        }
        if (!fs.existsSync(current)) {
            logger?.warn(
                `Could not resolve referenced file "${current}"` +
                (item?.referencedFrom ? ` from "${item.referencedFrom}".` : '.')
            );
            continue;
        }

        // Security: Resolve symlinks and verify the real path stays within project root
        const realCurrent = fs.realpathSync(current);
        if (!isWithinProjectRoot(realCurrent)) {
            logger?.warn(`Skipping file outside project root: "${current}"`);
            continue;
        }

        visited.add(current);
        const dir = path.dirname(current);
        const ext = path.extname(current).toLowerCase();
        let refs: string[] = [];
        if (ext === '.md') {
            refs = extractMarkdownReferences(fs.readFileSync(current, 'utf-8'));
        } else if (ext === '.json') {
            const parsed = JSON.parse(fs.readFileSync(current, 'utf-8'));
            refs = extractJsonReferences(parsed);
            const companion = companionMarkdownFor(current);
            if (companion) {
                // Convert absolute companion path to relative reference
                const relativeCompanion = path.relative(dir, companion);
                refs.push(relativeCompanion);
            }
        }

        for (const ref of refs) {
            // Security: Reject absolute references
            if (path.isAbsolute(ref)) {
                logger?.warn(`Skipping absolute reference: "${ref}" in "${current}"`);
                continue;
            }

            const resolved = path.resolve(dir, ref);

            // Security: Reject paths that escape the project root (e.g., ../../../etc/passwd)
            if (!isWithinProjectRoot(resolved)) {
                logger?.warn(`Skipping path escaping project root: "${ref}" in "${current}"`);
                continue;
            }

            if (!visited.has(resolved)) {
                queue.push({ filePath: resolved, referencedFrom: current });
            }
        }
    }

    return { files: Array.from(visited) };
}

function directoryDiscovery(directory: string, outputPath: string, logger: Logger): DiscoveryResult {
    const indexPath = path.join(directory, 'index.md');

    if (fs.lstatSync(directory).isSymbolicLink()) {
        throw new Error(`Input directory must not be a symbolic link: ${directory}`);
    }
    if (outputPath === indexPath ||
        (outputPath.startsWith(directory + path.sep) &&
            fs.existsSync(outputPath) && !outputPath.toLowerCase().endsWith('.zip'))) {
        throw new Error(`Output archive must not overwrite an input file: ${outputPath}`);
    }
    if (fs.existsSync(outputPath) && fs.lstatSync(outputPath).isSymbolicLink()) {
        throw new Error(`Output archive must not be a symbolic link: ${outputPath}`);
    }

    if (fs.readdirSync(directory).includes('index.md')) {
        if (!fs.lstatSync(indexPath).isFile()) {
            throw new Error(`index.md must be a regular file: ${indexPath}`);
        }
        return discoverDependencies(indexPath, logger);
    }

    const files: string[] = [];
    function visit(dir: string): void {
        for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const filePath = path.join(dir, item.name);
            if (item.isSymbolicLink()) {
                logger.warn(`Skipping symbolic link: "${filePath}"`);
            } else if (item.isDirectory()) {
                visit(filePath);
            } else if (item.isFile() && filePath !== outputPath) {
                files.push(filePath);
            }
        }
    }
    visit(directory);
    if (files.includes(path.join(directory, 'manifest.json'))) {
        throw new Error(`Input directory contains a reserved manifest.json: ${directory}`);
    }
    const artifacts = files.map(file =>
        `  - type: ${file.endsWith('.calm.json') ? 'architecture' : 'file'}\n    path: ${JSON.stringify(toZipEntryName(directory, file))}`
    ).join('\n');
    const index = Buffer.from(`---\nid: calm-export\ntitle: CALM Export\ntype: architecture\nartifacts:\n${artifacts || '  []'}\n---\n`);
    files.push(indexPath);
    logger.info('Generated OKF index.md in the archive; the input directory is not changed');
    return { files, generated: new Map([[indexPath, index]]) };
}

function resolveExportFiles(options: ExportCommandOptions, logger: Logger): { entryPath: string; discovery: DiscoveryResult } {
    const inputPath = path.resolve(options.entryPath);
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Export input not found: ${options.entryPath}`);
    }
    if (fs.statSync(inputPath).isDirectory()) {
        return {
            entryPath: path.join(inputPath, 'index.md'),
            discovery: directoryDiscovery(inputPath, path.resolve(options.outputPath), logger),
        };
    }
    if (path.basename(inputPath) !== 'index.md' || !fs.lstatSync(inputPath).isFile()) {
        throw new Error(`Export input must be a directory or index.md file: ${options.entryPath}`);
    }
    return { entryPath: inputPath, discovery: discoverDependencies(inputPath, logger) };
}

/** Finds the deepest common ancestor directory of a set of absolute file paths. */
export function computeCommonBaseDir(filePaths: string[]): string {
    const segmented = filePaths.map((filePath) => path.dirname(filePath).split(path.sep));
    let common = segmented[0] ?? [];

    for (const segments of segmented.slice(1)) {
        let i = 0;
        while (i < common.length && i < segments.length && common[i] === segments[i]) {
            i++;
        }
        common = common.slice(0, i);
    }

    return common.join(path.sep) || path.sep;
}

function toZipEntryName(baseDir: string, filePath: string): string {
    return path.relative(baseDir, filePath).split(path.sep).join('/');
}

/**
 * Computes the zip entry name for every discovered file relative to their common base
 * directory, keeping the index file at the archive root.
 */
export function computeZipEntryNames(discovery: DiscoveryResult): Map<string, string> {
    const primaryBaseDir = computeCommonBaseDir(discovery.files);

    const entryNames = new Map<string, string>();
    for (const file of discovery.files) {
        entryNames.set(file, toZipEntryName(primaryBaseDir, file));
    }
    return entryNames;
}

/**
 * Bundles a CALM architecture and all of its discoverable OKF documentation,
 * building blocks, and other local assets into a single zip archive. Files are stored
 * relative to their common base directory. No absolute paths from the machine running
 * the export are recorded, and a
 * `manifest.json` recording each file's sha256 hash is added to the archive.
 */
export async function runExportCommand(
    options: ExportCommandOptions,
    archiverFactory: (format: 'zip', options: { zlib: { level: number } }) => ArchiveWriter,
    logger: Logger
): Promise<void> {
    try {
        const { entryPath, discovery } = resolveExportFiles(options, logger);
        const discovered = discovery.files.sort();
        const entryNames = computeZipEntryNames(discovery);

        const outputDir = path.dirname(path.resolve(options.outputPath));
        fs.mkdirSync(outputDir, { recursive: true });

        const resolvedOutputPath = path.resolve(options.outputPath);
        if (discovered.includes(resolvedOutputPath)) {
            throw new Error(`Output archive path must not overwrite a discovered file: ${options.outputPath}`);
        }

        const files: ManifestFileEntry[] = [];
        const output = fs.createWriteStream(resolvedOutputPath);
        const archive = archiverFactory('zip', { zlib: { level: 9 } });

        const archiveClosed = new Promise<void>((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
        });
        archive.pipe(output);

        for (const filePath of discovered) {
            const entryName = entryNames.get(filePath) as string;
            const content = discovery.generated?.get(filePath) ?? fs.readFileSync(filePath);
            const sha256 = crypto.createHash('sha256').update(content).digest('hex');
            files.push({ path: entryName, sha256, size: content.length });
            archive.append(content, { name: entryName });
            logger.debug(`Added ${entryName} (${sha256})`);
        }

        const manifest: ExportManifest = {
            generatedAt: new Date().toISOString(),
            entryPoint: entryNames.get(entryPath) as string,
            fileCount: files.length,
            files,
        };
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        await archive.finalize();
        await archiveClosed;

        logger.info(`Exported ${files.length} file(s) to ${options.outputPath}`);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('An error occurred while exporting the CALM architecture: ' + message);
        throw err;
    }
}

/**
 * Bundles a CALM architecture using a simple ZIP archive interface.
 * This version is suitable for environments where the archiver package cannot be used.
 */
export async function runExportCommandSimple(
    options: ExportCommandOptions,
    archive: SimpleZipArchive,
    logger: Logger
): Promise<{ fileCount: number }> {
    try {
        const { entryPath, discovery } = resolveExportFiles(options, logger);
        const discovered = discovery.files.sort();
        const entryNames = computeZipEntryNames(discovery);

        const outputDir = path.dirname(path.resolve(options.outputPath));
        fs.mkdirSync(outputDir, { recursive: true });

        const resolvedOutputPath = path.resolve(options.outputPath);
        if (discovered.includes(resolvedOutputPath)) {
            throw new Error(`Output archive path must not overwrite a discovered file: ${options.outputPath}`);
        }

        const files: ManifestFileEntry[] = [];

        for (const filePath of discovered) {
            const entryName = entryNames.get(filePath) as string;
            const content = discovery.generated?.get(filePath) ?? fs.readFileSync(filePath);
            const sha256 = crypto.createHash('sha256').update(content).digest('hex');
            files.push({ path: entryName, sha256, size: content.length });
            archive.append(content, { name: entryName });
            logger.debug(`Added ${entryName} (${sha256})`);
        }

        const manifest: ExportManifest = {
            generatedAt: new Date().toISOString(),
            entryPoint: entryNames.get(entryPath) as string,
            fileCount: files.length,
            files,
        };
        archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

        await archive.finalize();

        logger.info(`Exported ${files.length} file(s) to ${options.outputPath}`);
        return { fileCount: files.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('An error occurred while exporting the CALM architecture: ' + message);
        throw err;
    }
}
