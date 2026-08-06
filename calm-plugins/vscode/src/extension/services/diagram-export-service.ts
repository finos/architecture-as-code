import * as vscode from 'vscode';
import * as path from 'path';

export class DiagramExportService {
    async exportDiagram(
        format: 'svg' | 'png',
        data: string,
        currentDocumentUri?: vscode.Uri,
    ): Promise<void> {
        const defaultName = this.computeDefaultName(currentDocumentUri, format);
        const defaultUri = currentDocumentUri
            ? vscode.Uri.file(path.join(path.dirname(currentDocumentUri.fsPath), defaultName))
            : undefined;

        const uri = await vscode.window.showSaveDialog({
            defaultUri,
            filters: format === 'svg'
                ? { 'SVG Image': ['svg'] }
                : { 'PNG Image': ['png'] },
            title: `Export Diagram as ${format.toUpperCase()}`,
        });

        if (!uri) return;

        const buffer = this.decodeData(format, data);
        await vscode.workspace.fs.writeFile(uri, buffer);
        vscode.window.showInformationMessage(`Diagram exported to ${path.basename(uri.fsPath)}`);
    }

    private computeDefaultName(uri: vscode.Uri | undefined, format: string): string {
        if (!uri) return `architecture.${format}`;
        const stem = path.basename(uri.fsPath, path.extname(uri.fsPath));
        return `${stem}-diagram.${format}`;
    }

    private decodeData(format: string, data: string): Uint8Array {
        if (format === 'svg') {
            return Buffer.from(data, 'utf-8');
        }
        return Buffer.from(data, 'base64');
    }
}
