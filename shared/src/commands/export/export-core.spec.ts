import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    computeCommonBaseDir,
    computeZipEntryNames,
    discoverDependencies,
    extractJsonReferences,
    extractMarkdownReferences,
    runExportCommand,
    runExportCommandSimple,
    type ArchiveWriter,
    type SimpleZipArchive,
} from './export-core.js';
import type { Logger } from '../../logger.js';

describe('bundle export core', () => {
    let tempDirectory: string;
    let projectDirectory: string;

    const createLogger = () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
    }) as unknown as Logger;

    beforeEach(() => {
        tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-export-'));
        projectDirectory = path.join(tempDirectory, 'project');
        fs.mkdirSync(projectDirectory);
    });

    afterEach(() => {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    it('extracts local Markdown references from front matter and links', () => {
        const markdown = [
            '---',
            '# comment',
            'artifacts:',
            '  - path: architecture.json',
            '  - path: ""',
            'calm-file: details.md, "other.md" # companion files',
            'calm-file:',
            '  - nested.md',
            '---',
            '[guide](guide.md) ![image](image.png)',
            '[anchor](#section) [email](mailto:team@example.com) [remote](https://example.com/a.md) [cdn](//example.com/a.md)',
        ].join('\n');

        expect(extractMarkdownReferences(markdown)).toEqual([
            'architecture.json', 'details.md', 'other.md', 'nested.md', 'guide.md', 'image.png',
        ]);
        expect(extractMarkdownReferences('[local](./readme.md)')).toEqual(['./readme.md']);
    });

    it('recursively extracts local JSON and Markdown references', () => {
        expect(extractJsonReferences({
            details: ['architecture.json', { document: 'guide.MD' }, null],
            external: 'https://example.com/remote.json',
            unrelated: 42,
        })).toEqual(['architecture.json', 'guide.MD']);
        expect(extractJsonReferences(null)).toEqual([]);
    });

    it('computes common archive roots and relative entry names', () => {
        const first = path.join(projectDirectory, 'docs', 'index.md');
        const second = path.join(projectDirectory, 'models', 'architecture.json');
        expect(computeCommonBaseDir([first, second])).toBe(projectDirectory);
        expect(computeCommonBaseDir([])).toBe(path.sep);
        expect(computeZipEntryNames({ files: [first, second] })).toEqual(new Map([
            [first, 'docs/index.md'],
            [second, 'models/architecture.json'],
        ]));
    });

    it('discovers linked files, JSON references, companion Markdown, and rejects escaping paths', () => {
        const indexPath = path.join(projectDirectory, 'index.md');
        fs.writeFileSync(indexPath, [
            '---',
            'artifacts:',
            '  - path: architecture.json',
            '---',
            '[guide](guide.md) [outside](../outside.md) [missing](missing.md)',
        ].join('\n'));
        fs.writeFileSync(path.join(projectDirectory, 'architecture.json'), JSON.stringify({ details: { file: 'details.md' } }));
        fs.writeFileSync(path.join(projectDirectory, 'architecture.md'), 'companion');
        fs.writeFileSync(path.join(projectDirectory, 'details.md'), 'details');
        fs.writeFileSync(path.join(projectDirectory, 'guide.md'), 'guide');
        fs.writeFileSync(path.join(tempDirectory, 'outside.md'), 'outside');

        const logger = createLogger();
        const result = discoverDependencies(indexPath, logger);
        expect(new Set(result.files)).toEqual(new Set([
            indexPath,
            path.join(projectDirectory, 'architecture.json'),
            path.join(projectDirectory, 'architecture.md'),
            path.join(projectDirectory, 'details.md'),
            path.join(projectDirectory, 'guide.md'),
        ]));
        expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('exports a directory with a generated index without changing the source directory', async () => {
        fs.writeFileSync(path.join(projectDirectory, 'architecture.calm.json'), '{"nodes":[]}');
        const nestedDirectory = path.join(projectDirectory, 'docs');
        fs.mkdirSync(nestedDirectory);
        fs.writeFileSync(path.join(nestedDirectory, 'guide.md'), 'guide');
        const outsideFile = path.join(tempDirectory, 'outside.txt');
        fs.writeFileSync(outsideFile, 'outside');
        fs.symlinkSync(outsideFile, path.join(projectDirectory, 'outside-link.txt'));
        const appended: Array<{ data: Buffer | string; name: string }> = [];
        const archive: SimpleZipArchive = {
            append: (data, options) => appended.push({ data, name: options.name }),
            finalize: vi.fn().mockResolvedValue(undefined),
        };
        const logger = createLogger();

        const result = await runExportCommandSimple({
            entryPath: projectDirectory,
            outputPath: path.join(tempDirectory, 'bundle.zip'),
            verbose: false,
        }, archive, logger);

        expect(result.fileCount).toBe(3);
        expect(appended.map(({ name }) => name)).toEqual([
            'architecture.calm.json', 'docs/guide.md', 'index.md', 'manifest.json',
        ]);
        expect(String(appended.find(({ name }) => name === 'index.md')?.data)).toContain('architecture.calm.json');
        expect(fs.existsSync(path.join(projectDirectory, 'index.md'))).toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Skipping symbolic link'));
        expect(archive.finalize).toHaveBeenCalledOnce();
    });

    it('uses an existing index in a directory and rejects a non-file index', async () => {
        const indexedDirectory = path.join(tempDirectory, 'indexed');
        fs.mkdirSync(indexedDirectory);
        fs.writeFileSync(path.join(indexedDirectory, 'index.md'), '[model](model.json)');
        fs.writeFileSync(path.join(indexedDirectory, 'model.json'), '{"nodes":[]}');
        const appended: Array<{ data: Buffer | string; name: string }> = [];
        const archive: SimpleZipArchive = {
            append: (data, options) => appended.push({ data, name: options.name }),
            finalize: vi.fn().mockResolvedValue(undefined),
        };

        await runExportCommandSimple({
            entryPath: indexedDirectory,
            outputPath: path.join(tempDirectory, 'indexed.zip'),
            verbose: false,
        }, archive, createLogger());
        expect(appended.map(({ name }) => name)).toEqual(['index.md', 'model.json', 'manifest.json']);

        const invalidDirectory = path.join(tempDirectory, 'invalid-index');
        fs.mkdirSync(path.join(invalidDirectory, 'index.md'), { recursive: true });
        await expect(runExportCommandSimple({
            entryPath: invalidDirectory,
            outputPath: path.join(tempDirectory, 'invalid.zip'),
            verbose: false,
        }, archive, createLogger())).rejects.toThrow('index.md must be a regular file');
    });

    it('rejects a project directory that is itself a symbolic link', async () => {
        const linkedDirectory = path.join(tempDirectory, 'linked-project');
        fs.symlinkSync(projectDirectory, linkedDirectory, 'dir');
        await expect(runExportCommandSimple({
            entryPath: linkedDirectory,
            outputPath: path.join(tempDirectory, 'linked.zip'),
            verbose: false,
        }, { append: vi.fn(), finalize: vi.fn() }, createLogger()))
            .rejects.toThrow('must not be a symbolic link');
    });

    it('exports an index document through the archive writer interface', async () => {
        const indexPath = path.join(projectDirectory, 'index.md');
        fs.writeFileSync(indexPath, '[model](model.json)');
        fs.writeFileSync(path.join(projectDirectory, 'model.json'), '{"nodes":[]}');
        const appended: Array<{ data: Buffer | string; name: string }> = [];
        let output: NodeJS.WritableStream;
        const writer: ArchiveWriter = {
            on: () => writer,
            pipe: (destination) => {
                output = destination;
                return destination;
            },
            append: (data, options) => appended.push({ data, name: options.name }),
            finalize: () => output.end(),
        };
        const logger = createLogger();

        await runExportCommand({
            entryPath: indexPath,
            outputPath: path.join(tempDirectory, 'archives', 'bundle.zip'),
            verbose: false,
        }, vi.fn(() => writer), logger);

        expect(appended.map(({ name }) => name)).toEqual(['index.md', 'model.json', 'manifest.json']);
        expect(fs.existsSync(path.join(tempDirectory, 'archives', 'bundle.zip'))).toBe(true);
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Exported 2 file(s)'));
    });

    it('logs and rethrows invalid export input', async () => {
        const logger = createLogger();
        await expect(runExportCommandSimple({
            entryPath: path.join(projectDirectory, 'missing'),
            outputPath: path.join(tempDirectory, 'bundle.zip'),
            verbose: false,
        }, { append: vi.fn(), finalize: vi.fn() }, logger)).rejects.toThrow('Export input not found');
        expect(logger.error).toHaveBeenCalledOnce();
    });

    it('rejects an archive path that would overwrite a discovered file', async () => {
        const indexPath = path.join(projectDirectory, 'index.md');
        fs.writeFileSync(indexPath, 'entry');
        await expect(runExportCommandSimple({
            entryPath: indexPath,
            outputPath: indexPath,
            verbose: false,
        }, { append: vi.fn(), finalize: vi.fn() }, createLogger()))
            .rejects.toThrow('must not overwrite a discovered file');
    });

    it('rejects non-index files and directories with a reserved manifest', async () => {
        const markdownPath = path.join(projectDirectory, 'notes.md');
        fs.writeFileSync(markdownPath, 'notes');
        const archive: SimpleZipArchive = { append: vi.fn(), finalize: vi.fn() };
        await expect(runExportCommandSimple({
            entryPath: markdownPath,
            outputPath: path.join(tempDirectory, 'bundle.zip'),
            verbose: false,
        }, archive, createLogger())).rejects.toThrow('directory or index.md file');

        fs.writeFileSync(path.join(projectDirectory, 'manifest.json'), '{}');
        await expect(runExportCommandSimple({
            entryPath: projectDirectory,
            outputPath: path.join(tempDirectory, 'bundle.zip'),
            verbose: false,
        }, archive, createLogger())).rejects.toThrow('reserved manifest.json');
    });

    it('does not overwrite a discovered file when using the archive writer', async () => {
        const indexPath = path.join(projectDirectory, 'index.md');
        fs.writeFileSync(indexPath, 'entry');
        await expect(runExportCommand({
            entryPath: indexPath,
            outputPath: indexPath,
            verbose: false,
        }, vi.fn(), createLogger())).rejects.toThrow('must not overwrite a discovered file');
    });

    it.each([new Error('archive setup failed'), 'archive setup failed'])(
        'logs and rethrows an archive writer error', async (failure) => {
            const indexPath = path.join(projectDirectory, 'index.md');
            fs.writeFileSync(indexPath, 'entry');
            const logger = createLogger();
            let output: ReturnType<typeof fs.createWriteStream>;
            const writer: ArchiveWriter = {
                on: () => writer,
                pipe: (destination) => {
                    output = destination as typeof output;
                    return destination;
                },
                append: vi.fn(),
                finalize: async () => {
                    await new Promise<void>((resolve) => output.once('open', resolve));
                    output.end();
                    throw failure;
                },
            };
            await expect(runExportCommand({
                entryPath: indexPath,
                outputPath: path.join(tempDirectory, 'bundle.zip'),
                verbose: false,
            }, () => writer, logger)).rejects.toBe(failure);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('archive setup failed'));
        }
    );
});