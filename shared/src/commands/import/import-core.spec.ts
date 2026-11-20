import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
    assertSafeEntryPath,
    getImportDestination,
    runImportCommand,
    type ZipEntry,
} from './import-core.js';
import type { ExportManifest } from '../export/export-core.js';
import type { Logger } from '../../logger.js';

describe('bundle import core', () => {
    let tempDirectory: string;
    let archivePath: string;

    const createLogger = () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        log: vi.fn(),
    }) as unknown as Logger;

    const makeEntry = (entryName: string, data: Buffer | string, isDirectory = false): ZipEntry => ({
        entryName,
        isDirectory,
        getData: () => Buffer.isBuffer(data) ? data : Buffer.from(data),
    });

    const makeManifest = (files: Array<{ path: string; data: Buffer }>, entryPoint = files[0]?.path ?? ''): Buffer => {
        const manifest: ExportManifest = {
            generatedAt: '2026-01-01T00:00:00.000Z',
            entryPoint,
            fileCount: files.length,
            files: files.map(({ path: filePath, data }) => ({
                path: filePath,
                sha256: crypto.createHash('sha256').update(data).digest('hex'),
                size: data.length,
            })),
        };
        return Buffer.from(JSON.stringify(manifest));
    };

    const runImport = (entries: ZipEntry[], outputDir = tempDirectory) => runImportCommand({
        inputPath: archivePath,
        outputDir,
        verbose: false,
    }, { getEntries: () => entries }, createLogger());

    beforeEach(() => {
        tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-import-'));
        archivePath = path.join(tempDirectory, 'bundle.zip');
        fs.writeFileSync(archivePath, 'mock zip');
    });

    afterEach(() => {
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });

    it('derives destinations from archive names and optional output directories', () => {
        expect(getImportDestination(archivePath)).toBe(path.join(tempDirectory, 'bundle'));
        expect(getImportDestination(archivePath, path.join(tempDirectory, 'output')))
            .toBe(path.join(tempDirectory, 'output', 'bundle'));
        expect(getImportDestination(path.join(tempDirectory, 'bundle.tar')))
            .toBe(path.join(tempDirectory, 'bundle.tar'));
        expect(() => getImportDestination('/')).toThrow('valid destination directory');
    });

    it('rejects absolute, empty, drive-prefixed, and traversing entry paths', () => {
        expect(() => assertSafeEntryPath('')).toThrow('Unsafe ZIP entry path');
        expect(() => assertSafeEntryPath('/absolute.txt')).toThrow('Unsafe ZIP entry path');
        expect(() => assertSafeEntryPath('C:\\absolute.txt')).toThrow('Unsafe ZIP entry path');
        expect(() => assertSafeEntryPath('docs/../secret.txt')).toThrow('Unsafe ZIP entry path');
        expect(() => assertSafeEntryPath('\\\\server\\share')).toThrow('Unsafe ZIP entry path');
        expect(() => assertSafeEntryPath('docs/spec.json')).not.toThrow();
    });

    it('verifies and extracts listed files while creating archive directories', () => {
        const index = Buffer.from('# Architecture');
        const spec = Buffer.from('{"nodes":[]}');
        const manifest = makeManifest([
            { path: 'index.md', data: index },
            { path: 'docs/spec.json', data: spec },
        ]);
        const result = runImport([
            makeEntry('index.md', index),
            makeEntry('docs/', '', true),
            makeEntry('docs/spec.json', spec),
            makeEntry('manifest.json', manifest),
        ]);

        expect(result.fileCount).toBe(3);
        expect(fs.readFileSync(path.join(result.destinationPath, 'index.md'), 'utf8')).toBe('# Architecture');
        expect(fs.readFileSync(path.join(result.destinationPath, 'docs', 'spec.json'), 'utf8')).toBe('{"nodes":[]}');
    });

    it('rejects invalid archives before extraction', () => {
        expect(() => runImport([makeEntry('../escape.txt', 'x')])).toThrow('Unsafe ZIP entry path');
        expect(() => runImport([])).toThrow('manifest.json not found');
        expect(() => runImport([makeEntry('manifest.json', '{')])).toThrow('not valid JSON');
        expect(() => runImport([makeEntry('manifest.json', JSON.stringify({ files: [], fileCount: 0 }))]))
            .toThrow('invalid manifest structure');
    });

    it('rejects duplicate, unlisted, and integrity-mismatched files', () => {
        const content = Buffer.from('good');
        const manifest = makeManifest([{ path: 'index.md', data: content }]);
        expect(() => runImport([
            makeEntry('index.md', content),
            makeEntry('index.md', content),
            makeEntry('manifest.json', manifest),
        ])).toThrow('Duplicate ZIP entry');
        expect(() => runImport([
            makeEntry('index.md', content),
            makeEntry('extra.md', 'extra'),
            makeEntry('manifest.json', manifest),
        ])).toThrow('unlisted file');
        expect(() => runImport([
            makeEntry('index.md', 'tampered'),
            makeEntry('manifest.json', manifest),
        ])).toThrow('integrity check failed');
    });

    it('rejects missing and malformed manifest entries', () => {
        const content = Buffer.from('index');
        const valid = makeManifest([{ path: 'index.md', data: content }]);
        const malformed = JSON.stringify({
            entryPoint: 'index.md',
            fileCount: 1,
            files: [{ path: '../index.md', sha256: 'a'.repeat(64), size: 5 }],
        });
        expect(() => runImport([makeEntry('manifest.json', valid)])).toThrow('missing file');
        expect(() => runImport([makeEntry('manifest.json', malformed)])).toThrow('Unsafe ZIP entry path');
        expect(() => runImport([
            makeEntry('index.md', content),
            makeEntry('manifest.json', JSON.stringify({
                entryPoint: 'index.md', fileCount: 1,
                files: [{ path: 'index.md', sha256: 'bad', size: content.length }],
            })),
        ])).toThrow('invalid file entry');
    });

    it('rejects non-ZIP input and symlink extraction destinations', () => {
        archivePath = path.join(tempDirectory, 'bundle.txt');
        fs.renameSync(path.join(tempDirectory, 'bundle.zip'), archivePath);
        expect(() => runImport([])).toThrow('.zip file');
        archivePath = path.join(tempDirectory, 'bundle.zip');
        fs.writeFileSync(archivePath, 'mock zip');

        const content = Buffer.from('index');
        const manifest = makeManifest([{ path: 'index.md', data: content }]);
        const destination = path.join(tempDirectory, 'bundle');
        const outside = path.join(tempDirectory, 'outside');
        fs.mkdirSync(outside);
        fs.symlinkSync(outside, destination);
        expect(() => runImport([
            makeEntry('index.md', content),
            makeEntry('manifest.json', manifest),
        ])).toThrow('symlink');
    });
});