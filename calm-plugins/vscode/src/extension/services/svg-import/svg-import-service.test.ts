import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { SvgImportService } from './svg-import-service';

const VALID_SVG = `<svg xmlns="http://www.w3.org/2000/svg">
    <g id="n1"><rect x="10" y="10" width="150" height="60"/><text x="85" y="45">Test Node</text></g>
</svg>`;

const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

function createMockDocument(content = '{}'): vscode.TextDocument {
    return {
        uri: vscode.Uri.file('/workspace/test.calm.json'),
        getText: () => content,
        positionAt: (offset: number) => ({ line: 0, character: offset }),
    } as unknown as vscode.TextDocument;
}

function createMockOutputChannel(): vscode.OutputChannel {
    return { appendLine: vi.fn() } as unknown as vscode.OutputChannel;
}

describe('SvgImportService', () => {
    let service: SvgImportService;

    beforeEach(() => {
        service = new SvgImportService(createMockOutputChannel());
        (vscode.window as Record<string, unknown>).showWarningMessage = vi.fn().mockResolvedValue('Import');
        (vscode.window as Record<string, unknown>).showOpenDialog = vi.fn().mockResolvedValue([vscode.Uri.file('/test.svg')]);
        (vscode.window as Record<string, unknown>).showInformationMessage = vi.fn().mockResolvedValue(undefined);
        (vscode.window as Record<string, unknown>).showErrorMessage = vi.fn().mockResolvedValue(undefined);
        (vscode.workspace as { fs: Record<string, unknown> }).fs = {
            readFile: vi.fn().mockResolvedValue(Buffer.from(VALID_SVG)),
            writeFile: vi.fn().mockResolvedValue(undefined),
        };
        (vscode.workspace as Record<string, unknown>).applyEdit = vi.fn().mockResolvedValue(true);
    });

    it('returns null when no document is open', async () => {
        const result = await service.importSvgIntoDocument(undefined);
        expect(result).toBeNull();
        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No CALM document is open.');
    });

    it('returns null when user cancels confirmation', async () => {
        (vscode.window as Record<string, unknown>).showWarningMessage = vi.fn().mockResolvedValue(undefined);
        const result = await service.importSvgIntoDocument(createMockDocument());
        expect(result).toBeNull();
    });

    it('returns null when user cancels file picker', async () => {
        (vscode.window as Record<string, unknown>).showOpenDialog = vi.fn().mockResolvedValue(undefined);
        const result = await service.importSvgIntoDocument(createMockDocument());
        expect(result).toBeNull();
    });

    it('returns null when SVG has no nodes', async () => {
        (vscode.workspace as { fs: Record<string, unknown> }).fs = {
            readFile: vi.fn().mockResolvedValue(Buffer.from(EMPTY_SVG)),
            writeFile: vi.fn().mockResolvedValue(undefined),
        };
        const result = await service.importSvgIntoDocument(createMockDocument());
        expect(result).toBeNull();
    });

    it('successfully imports SVG and replaces document', async () => {
        const result = await service.importSvgIntoDocument(createMockDocument());
        expect(result).not.toBeNull();
        const doc = JSON.parse(result!);
        expect(doc.nodes).toHaveLength(1);
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('returns null when applyEdit fails', async () => {
        (vscode.workspace as Record<string, unknown>).applyEdit = vi.fn().mockResolvedValue(false);
        const result = await service.importSvgIntoDocument(createMockDocument());
        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to apply the imported CALM JSON to the document.'
        );
    });

    it('returns null and shows error on parse failure', async () => {
        const invalidSvg = '<svg xmlns="http://www.w3.org/2000/svg"><not-valid-xml';
        (vscode.workspace as { fs: Record<string, unknown> }).fs = {
            readFile: vi.fn().mockResolvedValue(Buffer.from(invalidSvg)),
            writeFile: vi.fn().mockResolvedValue(undefined),
        };
        const result = await service.importSvgIntoDocument(createMockDocument());
        expect(result).toBeNull();
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
});
