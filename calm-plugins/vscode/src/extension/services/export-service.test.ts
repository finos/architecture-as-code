// SPDX-FileCopyrightText: 2026 CalmStudio Contributors
//
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';
import * as vscode from 'vscode';
import { ExportService, ExportCancelledError } from './export-service';

describe('ExportService', () => {
    let service: ExportService;
    let tempDir: string;
    let project: string;
    let originalSaveDialog: typeof vscode.window.showSaveDialog;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-test-'));
        project = path.join(tempDir, 'project');
        await fs.mkdir(path.join(project, 'docs'), { recursive: true });
        originalSaveDialog = vscode.window.showSaveDialog;
        service = new ExportService({ appendLine: vi.fn() } as unknown as vscode.OutputChannel);
    });

    afterEach(async () => {
        vscode.window.showSaveDialog = originalSaveDialog;
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it.each(['existing index', 'missing index'])('exports the directory with %s', async indexCase => {
        const architecture = path.join(project, 'architecture.calm.json');
        await fs.writeFile(architecture, '{}');
        await fs.writeFile(path.join(project, 'docs', 'unlinked.txt'), 'unlinked');
        if (indexCase === 'existing index') {
            await fs.writeFile(path.join(project, 'index.md'), '# Existing index\n\n[Architecture](architecture.calm.json)\n');
        }
        const output = path.join(tempDir, 'bundle.zip');
        vscode.window.showSaveDialog = async () => vscode.Uri.file(output);

        const result = await service.exportBundle({ architecturePath: architecture });
        const zip = new AdmZip(output);
        const existing = indexCase === 'existing index';
        expect(result.fileCount).toBe(existing ? 2 : 3);
        expect(result.warnings).toEqual([]);
        expect(zip.getEntries().map(entry => entry.entryName).sort()).toEqual(existing
            ? ['architecture.calm.json', 'index.md', 'manifest.json']
            : ['architecture.calm.json', 'docs/unlinked.txt', 'index.md', 'manifest.json']);
        expect(JSON.parse(zip.readAsText('manifest.json')).entryPoint).toBe('index.md');
        if (indexCase === 'missing index') {
            expect(zip.readAsText('index.md')).toContain('path: "architecture.calm.json"');
            await expect(fs.access(path.join(project, 'index.md'))).rejects.toThrow();
        } else {
            expect(zip.readAsText('index.md')).toContain('# Existing index');
        }
    });

    it('uses the selected document directory rather than other workspace indexes', async () => {
        await fs.writeFile(path.join(project, 'architecture.calm.json'), '{}');
        await fs.mkdir(path.join(tempDir, 'other'));
        await fs.writeFile(path.join(tempDir, 'other', 'index.md'), '# Other');
        const output = path.join(tempDir, 'bundle.zip');
        vscode.window.showSaveDialog = async () => vscode.Uri.file(output);

        await service.exportBundle({ currentDirectory: project });
        expect(new AdmZip(output).readAsText('index.md')).not.toBe('# Other');
    });

    it('rejects saving the bundle within the input directory', async () => {
        await fs.writeFile(path.join(project, 'architecture.calm.json'), '{}');
        const output = path.join(project, 'bundle.zip');
        vscode.window.showSaveDialog = async () => vscode.Uri.file(output);

        await expect(service.exportBundle({ currentDirectory: project }))
            .rejects.toThrow('Save the bundle outside the input directory');
        await expect(fs.access(output)).rejects.toThrow();
    });

    it('reports cancellation and missing directory explicitly', async () => {
        await expect(service.exportBundle()).rejects.toThrow('No directory selected for export');
        await fs.writeFile(path.join(project, 'architecture.calm.json'), '{}');
        vscode.window.showSaveDialog = async () => undefined;
        await expect(service.exportBundle({ currentDirectory: project })).rejects.toBeInstanceOf(ExportCancelledError);
    });
});
