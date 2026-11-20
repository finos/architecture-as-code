// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import {
    runExportCommandSimple,
    type ExportCommandOptions,
    type Logger,
    type SimpleZipArchive,
} from '@finos/calm-shared/bundle';

export interface ExportOptions {
    architecturePath?: string;
    currentDirectory?: string;
}

export interface ExportResult {
    archivePath: string;
    fileCount: number;
    warnings: string[];
}

class VSCodeZipArchive implements SimpleZipArchive {
    private entries: Map<string, Buffer> = new Map();

    constructor(private outputPath: string) {}

    append(data: Buffer | string, options: { name: string }): void {
        this.entries.set(options.name, Buffer.isBuffer(data) ? data : Buffer.from(data));
    }

    async finalize(): Promise<void> {
        const AdmZip = await import('adm-zip');
        const zip = new AdmZip.default();
        for (const [name, data] of this.entries) {
            zip.addFile(name, data);
        }
        zip.writeZip(this.outputPath);
    }
}

export class ExportService {
    constructor(private log: vscode.OutputChannel) {}

    async exportBundle(options: ExportOptions = {}): Promise<ExportResult> {
        const directory = options.currentDirectory ??
            (options.architecturePath ? path.dirname(options.architecturePath) : undefined);
        if (!directory) {
            throw new Error('No directory selected for export');
        }

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calm-export-'));
        const tempZip = path.join(tempDir, 'export.zip');
        try {
            const warnings: string[] = [];
            const exportOptions: ExportCommandOptions = {
                entryPath: directory,
                outputPath: tempZip,
                verbose: false,
            };
            const result = await runExportCommandSimple(
                exportOptions,
                new VSCodeZipArchive(tempZip),
                this.createLogger(message => warnings.push(message))
            );

            const defaultName = path.basename(options.architecturePath ?? 'architecture', '.json');
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${defaultName}-export.zip`),
                filters: { 'ZIP Archive': ['zip'] },
                title: 'Save CALM Bundle',
            });
            if (!saveUri) {
                throw new ExportCancelledError('Export cancelled by user');
            }

            const relativeOutput = path.relative(directory, saveUri.fsPath);
            if (!relativeOutput.startsWith('..' + path.sep) && relativeOutput !== '..' &&
                !path.isAbsolute(relativeOutput)) {
                throw new Error('Save the bundle outside the input directory');
            }

            await fs.copyFile(tempZip, saveUri.fsPath);
            this.log.appendLine(`[Export] Saved to: ${saveUri.fsPath}`);
            return { archivePath: saveUri.fsPath, fileCount: result.fileCount, warnings };
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
    }

    private createLogger(onWarn: (message: string) => void): Logger {
        const write = (level: string, message: string) =>
            this.log.appendLine(`[Export] ${level}: ${message}`);
        return {
            log: (level, message) => write(String(level), message),
            debug: message => write('debug', message),
            info: message => write('info', message),
            warn: message => {
                onWarn(message);
                write('warn', message);
            },
            error: message => write('error', message),
        };
    }
}

export class ExportCancelledError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ExportCancelledError';
    }
}
