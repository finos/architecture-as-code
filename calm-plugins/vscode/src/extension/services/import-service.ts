// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import AdmZip from 'adm-zip';
import {
    runImportCommand,
    getImportDestination,
    assertSafeEntryPath,
    type ImportCommandOptions,
    type ImportResult as CoreImportResult,
    type ZipReader,
    type ZipEntry,
} from '@finos/calm-shared/bundle';

export interface ImportOptions {
    zipPath?: string;
}

export interface ImportResult {
    extractedPath: string;
    fileCount: number;
    entryPoint?: string;
}

export interface CalmManifest {
    generatedAt: string;
    entryPoint: string;
    fileCount: number;
    files: Array<{
        path: string;
        sha256: string;
        size: number;
    }>;
}

// VSCode-compatible ZipReader implementation using adm-zip
class VSCodeZipReader implements ZipReader {
    private archive: AdmZip;

    constructor(archivePath: string) {
        // Loaded dynamically in getEntries
        this.archive = new AdmZip(archivePath);
    }

    getEntries(): ZipEntry[] {
        return this.archive.getEntries().map((entry: import('adm-zip').IZipEntry) => ({
            entryName: entry.entryName,
            isDirectory: entry.isDirectory,
            getData: () => entry.getData(),
        }));
    }
}

export class ImportService {
    private log: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.log = outputChannel;
    }

    /**
     * Import a CALM architecture bundle
     */
    async importBundle(options: ImportOptions = {}): Promise<ImportResult> {
        this.log.appendLine('[Import] Starting import bundle process');

        // Get ZIP path if not provided
        const zipPath = options.zipPath ?? await this.promptForZipFile();
        if (!zipPath) {
            throw new ImportCancelledError('Import cancelled by user');
        }

        this.log.appendLine(`[Import] Importing from: ${zipPath}`);

        // Validate ZIP
        const manifest = await this.validateAndGetManifest(zipPath);
        this.log.appendLine(`[Import] Valid manifest found, entry point: ${manifest.entryPoint}`);

        // Prompt for extraction directory
        const extractDir = await this.promptForExtractionDir(zipPath);
        if (!extractDir) {
            throw new ImportCancelledError('Import cancelled by user');
        }

        // Core extracts into <extractDir>/<zip name>, so check that folder
        const destination = getImportDestination(zipPath, extractDir);
        const exists = await this.directoryExistsAndHasContent(destination);
        if (exists) {
            const choice = await vscode.window.showWarningMessage(
                `Directory "${path.basename(destination)}" already exists and contains files.`,
                { modal: true },
                'Overwrite',
                'Cancel'
            );
            if (choice !== 'Overwrite') {
                throw new ImportCancelledError('Import cancelled by user');
            }
        }

        // Run import using shared core
        const importOptions: ImportCommandOptions = {
            inputPath: zipPath,
            outputDir: extractDir,
            verbose: false,
        };

        const zipReader = new VSCodeZipReader(zipPath);
        const coreResult: CoreImportResult = await runImportCommand(
            importOptions,
            zipReader,
            {
                log: (level: string, msg: string) => this.log.appendLine(`[Import] ${level}: ${msg}`),
                info: (msg: string) => this.log.appendLine(`[Import] ${msg}`),
                warn: (msg: string) => this.log.appendLine(`[Import] warn: ${msg}`),
                debug: (msg: string) => this.log.appendLine(`[Import] debug: ${msg}`),
                error: (msg: string) => this.log.appendLine(`[Import] error: ${msg}`),
            }
        );

        // Open the imported architecture
        await this.openImportedArchitecture(coreResult.destinationPath, this.safeEntryPoint(manifest));

        return {
            extractedPath: coreResult.destinationPath,
            fileCount: coreResult.fileCount,
            entryPoint: manifest.entryPoint,
        };
    }

    /**
     * Prompt user to select a ZIP file
     */
    private async promptForZipFile(): Promise<string | undefined> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'CALM Bundle': ['zip'],
                'All Files': ['*'],
            },
            title: 'Select CALM Bundle to Import',
        });

        return uris?.[0]?.fsPath;
    }

    /**
     * Prompt user for extraction directory
     */
    private async promptForExtractionDir(zipPath: string): Promise<string> {
        const defaultName = path.basename(zipPath, '.zip');
        const workspaceRoot = this.getWorkspaceRoot();
        const defaultUri = vscode.Uri.file(path.join(workspaceRoot, defaultName));

        const uri = await vscode.window.showSaveDialog({
            defaultUri,
            title: 'Select Directory to Extract CALM Bundle',
        });

        if (!uri) {
            throw new ImportCancelledError('Import cancelled by user');
        }

        return uri.fsPath;
    }

    /**
     * Validate ZIP and extract manifest
     */
    private async validateAndGetManifest(zipPath: string): Promise<CalmManifest> {
        // Check file exists
        try {
            await fs.access(zipPath);
        } catch {
            throw new Error(`ZIP file not found: ${zipPath}`);
        }

        // Check it's a .zip file
        if (!zipPath.toLowerCase().endsWith('.zip')) {
            throw new Error('Import file must be a .zip archive');
        }

        // Read and validate manifest
        let manifest: CalmManifest;
        try {
            const AdmZip = await import('adm-zip');
            const zip = new AdmZip.default(zipPath);
            const manifestEntry = zip.getEntry('manifest.json');

            if (!manifestEntry) {
                throw new Error('Invalid CALM bundle: manifest.json not found');
            }

            manifest = JSON.parse(manifestEntry.getData().toString()) as CalmManifest;
        } catch (err) {
            if (err instanceof Error && err.message.includes('manifest.json')) {
                throw err;
            }
            throw new Error(`Failed to read CALM bundle: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Validate manifest structure
        if (!manifest.entryPoint) {
            throw new Error('Invalid CALM bundle: manifest.json missing entryPoint');
        }

        if (!Array.isArray(manifest.files)) {
            throw new Error('Invalid CALM bundle: manifest.json missing files array');
        }

        return manifest;
    }

    /**
     * Return the manifest entry point only if it is a safe relative path that the manifest lists
     */
    private safeEntryPoint(manifest: CalmManifest): string | undefined {
        const entryPoint = manifest.entryPoint;
        try {
            assertSafeEntryPath(entryPoint);
        } catch {
            this.log.appendLine(`[Import] Ignoring unsafe manifest entryPoint: ${entryPoint}`);
            return undefined;
        }
        if (!manifest.files.some((file) => file?.path === entryPoint)) {
            this.log.appendLine(`[Import] Ignoring entryPoint not listed in manifest: ${entryPoint}`);
            return undefined;
        }
        return entryPoint;
    }

    /**
     * Parse file count from CLI output
     */
    private parseFileCount(stdout: string): number {
        const match = stdout.match(/Imported (\d+) file/i);
        if (match) {
            return parseInt(match[1]!, 10);
        }
        return 0;
    }

    /**
     * Open the imported architecture in the editor
     */
    private async openImportedArchitecture(extractDir: string, entryPoint?: string): Promise<void> {
        let archPath: string | undefined;

        // Try entry point from manifest first
        if (entryPoint) {
            const fullPath = path.resolve(extractDir, entryPoint);
            const relative = path.relative(extractDir, fullPath);
            const contained = relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
            if (contained && await this.fileExists(fullPath)) {
                archPath = fullPath;
            }
        }

        // Search for .calm.json files if entry point not found
        if (!archPath) {
            archPath = await this.findCalmArchitecture(extractDir);
        }

        // Open the file if found
        if (archPath) {
            this.log.appendLine(`[Import] Opening imported architecture: ${archPath}`);
            const doc = await vscode.workspace.openTextDocument(archPath);
            await vscode.window.showTextDocument(doc);

            // Also open in CALM Canvas
            const openInCanvas = await vscode.window.showInformationMessage(
                'Open imported architecture in CALM Canvas?',
                'Yes',
                'No'
            );
            if (openInCanvas === 'Yes') {
                await vscode.commands.executeCommand('calm.openCanvas', vscode.Uri.file(archPath));
            }
        } else {
            this.log.appendLine('[Import] No architecture file found to open');
            // Open the folder in explorer instead
            await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(extractDir));
        }
    }

    private async findCalmArchitecture(directory: string): Promise<string | undefined> {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        entries.sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const entryPath = path.join(directory, entry.name);
            if (entry.isFile() && entry.name.endsWith('.calm.json')) return entryPath;
            if (entry.isDirectory()) {
                const nested = await this.findCalmArchitecture(entryPath);
                if (nested) return nested;
            }
        }
        return undefined;
    }

    /**
     * Check if directory exists and has content
     */
    private async directoryExistsAndHasContent(dirPath: string): Promise<boolean> {
        try {
            const stat = await fs.stat(dirPath);
            if (!stat.isDirectory()) {
                return false;
            }
            const entries = await fs.readdir(dirPath);
            return entries.length > 0;
        } catch {
            return false;
        }
    }

    private getWorkspaceRoot(): string {
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
            return folders[0]!.uri.fsPath;
        }
        return process.cwd();
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

export class ImportCancelledError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImportCancelledError';
    }
}
