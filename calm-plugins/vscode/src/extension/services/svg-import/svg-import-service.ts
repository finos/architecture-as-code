import * as vscode from 'vscode';
import { detectSvgFormat } from './format-detector';
import { parseDrawioSvg } from './drawio-parser';
import { parseGenericSvg } from './generic-svg-parser';
import { buildCalmJson } from './calm-builder';
import type { ImportResult } from './types';

export class SvgImportService {
    private log: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.log = outputChannel;
    }

    async importSvgIntoDocument(currentDocument: vscode.TextDocument | undefined): Promise<string | null> {
        this.log.appendLine(`[SvgImport] importSvgIntoDocument called, document=${currentDocument?.uri.fsPath ?? 'undefined'}`);

        if (!currentDocument) {
            vscode.window.showWarningMessage('No CALM document is open.');
            return null;
        }

        const confirm = await vscode.window.showWarningMessage(
            'This will replace the current architecture with the imported SVG diagram. Continue?',
            { modal: true },
            'Import'
        );
        this.log.appendLine(`[SvgImport] User confirmation: ${confirm}`);
        if (confirm !== 'Import') return null;

        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'SVG Files': ['svg'] },
            title: 'Select SVG to import as CALM architecture',
        });
        if (!uris || uris.length === 0) return null;

        const uri = uris[0]!;
        this.log.appendLine(`[SvgImport] Reading SVG: ${uri.fsPath}`);

        const content = Buffer.from(
            await vscode.workspace.fs.readFile(uri)
        ).toString('utf-8');

        const result = await this.parseSvg(content);
        if (!result) return null;

        if (result.nodeCount === 0) {
            vscode.window.showWarningMessage('No nodes found in the SVG. The file may not contain diagram elements.');
            return null;
        }

        if (result.warnings.length > 0) {
            this.log.appendLine(`[SvgImport] Warnings: ${result.warnings.join('; ')}`);
            vscode.window.showWarningMessage(
                `Imported with ${result.warnings.length} warning(s). See CALM Canvas output for details.`
            );
        }

        // Write to the current document
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            currentDocument.positionAt(0),
            currentDocument.positionAt(currentDocument.getText().length)
        );
        edit.replace(currentDocument.uri, fullRange, result.json);
        await vscode.workspace.applyEdit(edit);

        vscode.window.showInformationMessage(
            `Imported ${result.nodeCount} nodes and ${result.relationshipCount} relationships from SVG.`
        );

        this.log.appendLine(
            `[SvgImport] Complete: ${result.nodeCount} nodes, ${result.relationshipCount} relationships`
        );

        return result.json;
    }

    async importSvgToNewFile(sourceUri?: vscode.Uri): Promise<void> {
        const uri = sourceUri ?? await this.promptForFile();
        if (!uri) return;

        const content = Buffer.from(
            await vscode.workspace.fs.readFile(uri)
        ).toString('utf-8');

        const result = await this.parseSvg(content);
        if (!result) return;

        if (result.nodeCount === 0) {
            vscode.window.showWarningMessage('No nodes found in the SVG.');
            return;
        }

        const path = await import('path');
        const stem = path.basename(uri.fsPath, '.svg');
        const defaultName = `${stem}.calm.json`;
        const defaultUri = vscode.Uri.file(
            path.join(path.dirname(uri.fsPath), defaultName)
        );

        const outputUri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'CALM JSON': ['json'] },
            title: 'Save imported CALM architecture',
        });
        if (!outputUri) return;

        await vscode.workspace.fs.writeFile(outputUri, Buffer.from(result.json, 'utf-8'));

        if (result.warnings.length > 0) {
            this.log.appendLine(`[SvgImport] Warnings: ${result.warnings.join('; ')}`);
        }

        vscode.window.showInformationMessage(
            `Imported ${result.nodeCount} nodes, ${result.relationshipCount} relationships → ${path.basename(outputUri.fsPath)}`
        );

        const open = await vscode.window.showInformationMessage(
            'Open in CALM Canvas?', 'Yes', 'No'
        );
        if (open === 'Yes') {
            await vscode.commands.executeCommand('calm.openCanvas', outputUri);
        }
    }

    private async parseSvg(content: string): Promise<ImportResult | null> {
        try {
            const format = detectSvgFormat(content);
            this.log.appendLine(`[SvgImport] Detected format: ${format}`);

            const graph = format === 'drawio'
                ? await parseDrawioSvg(content)
                : parseGenericSvg(content);

            this.log.appendLine(
                `[SvgImport] Parsed: ${graph.nodes.length} nodes, ${graph.edges.length} edges`
            );

            return buildCalmJson(graph);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.log.appendLine(`[SvgImport] ERROR: ${message}`);
            vscode.window.showErrorMessage(`Failed to parse SVG: ${message}`);
            return null;
        }
    }

    private async promptForFile(): Promise<vscode.Uri | undefined> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'SVG Files': ['svg'] },
            title: 'Select SVG to import as CALM architecture',
        });
        return uris?.[0];
    }
}
