// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Logger } from '../../logger.js';
import type { ExportManifest } from '../export/export-core.js';

export interface ImportCommandOptions {
    inputPath: string;
    outputDir?: string;
    verbose: boolean;
}

export interface ImportResult {
    archivePath: string;
    destinationPath: string;
    fileCount: number;
}

function archiveDirectoryName(archivePath: string): string {
    const name = path.basename(archivePath);
    return name.toLowerCase().endsWith('.zip') ? name.slice(0, -4) : name;
}

export function getImportDestination(inputPath: string, outputDir?: string): string {
    const archivePath = path.resolve(inputPath);
    const parent = outputDir ? path.resolve(outputDir) : path.dirname(archivePath);
    const directoryName = archiveDirectoryName(archivePath);
    if (!directoryName || directoryName === '.' || directoryName === '..') {
        throw new Error(`Import archive name must produce a valid destination directory: ${path.basename(archivePath)}`);
    }
    return path.join(parent, directoryName);
}

export function assertSafeEntryPath(entryName: string): void {
    const normalized = entryName.replaceAll('\\', '/');
    if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
        throw new Error(`Unsafe ZIP entry path: ${entryName}`);
    }

    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '..')) {
        throw new Error(`Unsafe ZIP entry path: ${entryName}`);
    }
}

function assertNoSymlinksOutsideDestination(destination: string, entryName: string): void {
    const normalized = entryName.replaceAll('\\', '/');
    // Security: Reject if destination itself is a symlink before resolving
    if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) {
        throw new Error(`Unsafe ZIP extraction destination: ${destination} is a symlink`);
    }
    const destinationRoot = fs.existsSync(destination) ? fs.realpathSync(destination) : path.resolve(destination);
    let cursor = destinationRoot;

    for (const segment of normalized.split('/').filter(Boolean)) {
        cursor = path.join(cursor, segment);
        if (!fs.existsSync(cursor)) {
            continue;
        }

        const stat = fs.lstatSync(cursor);
        if (stat.isSymbolicLink()) {
            throw new Error(`Unsafe ZIP entry path: ${entryName} (destination contains a symlink)`);
        }

        const realPath = fs.realpathSync(cursor);
        const relative = path.relative(destinationRoot, realPath);
        if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
            throw new Error(`Unsafe ZIP entry path: ${entryName} (destination contains a symlink outside the import tree)`);
        }
    }
}

function ensureWithinDestination(destination: string, entryName: string): string {
    const normalized = entryName.replaceAll('\\', '/');
    const target = path.resolve(destination, ...normalized.split('/'));
    const relative = path.relative(destination, target);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Unsafe ZIP entry path: ${entryName}`);
    }
    assertNoSymlinksOutsideDestination(destination, entryName);
    return target;
}

export interface ZipEntry {
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
}

export interface ZipReader {
    getEntries(): ZipEntry[];
}

function verifyBundle(entries: ZipEntry[]): Map<string, Buffer> {
    const archiveFiles = new Map<string, ZipEntry>();
    for (const entry of entries) {
        assertSafeEntryPath(entry.entryName);
        const name = entry.entryName.replaceAll('\\', '/');
        const segments = name.split('/');
        if (entry.isDirectory && name.endsWith('/')) segments.pop();
        if (segments.some(segment => !segment || segment === '.') || (!entry.isDirectory && name.endsWith('/'))) {
            throw new Error(`Invalid ZIP entry path: ${entry.entryName}`);
        }
        const key = entry.isDirectory ? name.replace(/\/$/, '') : name;
        if (archiveFiles.has(key)) {
            throw new Error(`Duplicate ZIP entry: ${key}`);
        }
        archiveFiles.set(key, entry);
    }

    const manifestEntry = archiveFiles.get('manifest.json');
    if (!manifestEntry || manifestEntry.isDirectory) {
        throw new Error('Invalid CALM bundle: manifest.json not found');
    }
    const manifestData = manifestEntry.getData();
    let manifest: ExportManifest;
    try {
        manifest = JSON.parse(manifestData.toString('utf8')) as ExportManifest;
    } catch {
        throw new Error('Invalid CALM bundle: manifest.json is not valid JSON');
    }
    if (!manifest || !Array.isArray(manifest.files) ||
        !Number.isSafeInteger(manifest.fileCount) || manifest.fileCount !== manifest.files.length ||
        typeof manifest.entryPoint !== 'string') {
        throw new Error('Invalid CALM bundle: invalid manifest structure');
    }
    assertSafeEntryPath(manifest.entryPoint);

    const verified = new Map<string, Buffer>();
    for (const file of manifest.files) {
        if (!file || typeof file.path !== 'string' || typeof file.sha256 !== 'string' ||
            !/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) {
            throw new Error('Invalid CALM bundle: invalid file entry');
        }
        assertSafeEntryPath(file.path);
        if (file.path === 'manifest.json' || file.path.includes('\\') ||
            file.path.split('/').some(segment => !segment || segment === '.')) {
            throw new Error(`Invalid CALM bundle: invalid file path: ${file.path}`);
        }
        if (verified.has(file.path)) {
            throw new Error(`Invalid CALM bundle: duplicate file: ${file.path}`);
        }
        const entry = archiveFiles.get(file.path);
        if (!entry || entry.isDirectory) {
            throw new Error(`Invalid CALM bundle: missing file: ${file.path}`);
        }
        const data = entry.getData();
        if (data.length !== file.size ||
            crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) {
            throw new Error(`Invalid CALM bundle: integrity check failed: ${file.path}`);
        }
        verified.set(file.path, data);
    }
    if (!verified.has(manifest.entryPoint)) {
        throw new Error(`Invalid CALM bundle: entryPoint is not listed: ${manifest.entryPoint}`);
    }
    for (const [name, entry] of archiveFiles) {
        if (!entry.isDirectory && name !== 'manifest.json' && !verified.has(name)) {
            throw new Error(`Invalid CALM bundle: unlisted file: ${name}`);
        }
    }
    verified.set('manifest.json', manifestData);
    return verified;
}

export function runImportCommand(
    options: ImportCommandOptions,
    zipReader: ZipReader,
    logger: Logger
): ImportResult {
    const archivePath = path.resolve(options.inputPath);

    if (!fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) {
        throw new Error(`Import archive not found: ${options.inputPath}`);
    }
    if (!archivePath.toLowerCase().endsWith('.zip')) {
        throw new Error(`Import input must be a .zip file: ${options.inputPath}`);
    }

    const destinationPath = getImportDestination(archivePath, options.outputDir);
    const entries = zipReader.getEntries();
    const verified = verifyBundle(entries);

    for (const entry of entries) {
        ensureWithinDestination(destinationPath, entry.entryName);
    }

    fs.mkdirSync(destinationPath, { recursive: true });
    let fileCount = 0;
    for (const entry of entries) {
        if (entry.isDirectory) {
            fs.mkdirSync(ensureWithinDestination(destinationPath, entry.entryName), { recursive: true });
            continue;
        }
        const target = ensureWithinDestination(destinationPath, entry.entryName);
        const data = verified.get(entry.entryName.replaceAll('\\', '/'));
        if (!data) {
            throw new Error(`Invalid CALM bundle: unverified file: ${entry.entryName}`);
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
        fileCount += 1;
        logger.debug(`Imported ${entry.entryName}`);
    }

    logger.info(`Imported ${fileCount} file(s) to ${destinationPath}`);
    return { archivePath, destinationPath, fileCount };
}
