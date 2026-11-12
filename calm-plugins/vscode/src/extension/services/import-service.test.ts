import AdmZip from 'adm-zip';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { ImportService } from './import-service';

describe('ImportService bundle integrity', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-vscode-import-'));
    const zipPath = path.join(tempDir, 'bundle.zip');
    const parent = path.join(tempDir, 'imports');
    const originalShowSaveDialog = vscode.window.showSaveDialog;

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    afterEach(() => {
        fs.rmSync(zipPath, { force: true });
        fs.rmSync(parent, { recursive: true, force: true });
        vscode.window.showSaveDialog = originalShowSaveDialog;
        vi.restoreAllMocks();
    });

    function writeArchive(content: string): void {
        const data = Buffer.from(content);
        const zip = new AdmZip();
        zip.addFile('index.md', data);
        zip.addFile('manifest.json', Buffer.from(JSON.stringify({
            generatedAt: new Date().toISOString(),
            entryPoint: 'index.md',
            fileCount: 1,
            files: [{
                path: 'index.md',
                size: data.length,
                sha256: crypto.createHash('sha256').update(data).digest('hex'),
            }],
        })));
        zip.writeZip(zipPath);
    }

    function createService(): ImportService {
        vscode.window.showSaveDialog = async () => vscode.Uri.file(parent);
        const service = new ImportService({ appendLine: vi.fn() } as unknown as vscode.OutputChannel);
        vi.spyOn(
            service as unknown as { openImportedArchitecture: (dir: string, entry?: string) => Promise<void> },
            'openImportedArchitecture'
        ).mockResolvedValue(undefined);
        return service;
    }

    it('extracts a valid bundle and opens its entry point', async () => {
        writeArchive('# Index');
        const service = createService();
        const result = await service.importBundle({ zipPath });
        expect(result.fileCount).toBe(2);
        expect(fs.readFileSync(path.join(result.extractedPath, 'index.md'), 'utf8')).toBe('# Index');
        expect(service['openImportedArchitecture']).toHaveBeenCalledWith(result.extractedPath, 'index.md');
    });

    it('rejects modified content before writing any files', async () => {
        writeArchive('# Index');
        const zip = new AdmZip(zipPath);
        zip.updateFile('index.md', Buffer.from('# Tampered'));
        zip.writeZip(zipPath);

        await expect(createService().importBundle({ zipPath })).rejects.toThrow('integrity check failed');
        expect(fs.existsSync(path.join(parent, 'bundle'))).toBe(false);
    });
});
