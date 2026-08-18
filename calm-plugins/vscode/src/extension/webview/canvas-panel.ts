import * as vscode from 'vscode';
import { getWebviewHtml } from './html-provider';
import { SyncCoordinator } from '../services/sync-coordinator';
import { WorkspaceAssetService } from '../services/workspace-asset-service';
import { DiagramExportService } from '../services/diagram-export-service';
import { SvgImportService } from '../services/svg-import';
import type {
    ExtToWebviewMessage,
    WebviewToExtMessage,
} from '../types/messages';

export class CanvasPanel {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private disposeCallbacks: Array<() => void> = [];
    private currentDocument: vscode.TextDocument | undefined;
    private syncCoordinator = new SyncCoordinator();
    private assetService: WorkspaceAssetService | undefined;
    private exportService = new DiagramExportService();
    private importService: SvgImportService | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private log: vscode.OutputChannel;

    private disposed = false;
    private scanReady = false;
    private webviewReady = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        outputChannel: vscode.OutputChannel
    ) {
        this.log = outputChannel;
        this.importService = new SvgImportService(outputChannel);
        const workspaceRoot =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        this.log.appendLine(
            `[CanvasPanel] constructor, workspaceRoot: ${workspaceRoot}`
        );
        this.assetService = new WorkspaceAssetService(workspaceRoot);
        void this.assetService.scanAll().then(() => {
            const fn = this.assetService!.getBuildingBlocks();
            const p = this.assetService!.getPatterns();
            const t = this.assetService!.getTemplates();
            const s = this.assetService!.getStandards();
            this.log.appendLine(
                `[CanvasPanel] Scan complete: ${fn.length} building-blocks, ${p.length} patterns, ${t.length} templates, ${s.length} standards`
            );
            this.scanReady = true;
            // If webview was already waiting, send now
            if (this.webviewReady) {
                this.log.appendLine(
                    '[CanvasPanel] Webview was waiting — sending assets now'
                );
                this.sendAssets();
            }
        });
        this.assetService.registerWatchers(context, () => this.sendAssets());
    }

    reveal(document: vscode.TextDocument): void {
        this.currentDocument = document;

        if (!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'calmCanvas',
                'CALM Canvas',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(
                            this.context.extensionUri,
                            'dist',
                            'webview'
                        ),
                    ],
                }
            );

            this.panel.onDidDispose(
                () => this.dispose(),
                null,
                this.disposables
            );
            this.panel.webview.onDidReceiveMessage(
                (msg: WebviewToExtMessage) => this.handleMessage(msg),
                null,
                this.disposables
            );

            this.registerFileWatcher(document);
        }

        this.panel.webview.html = getWebviewHtml(
            this.panel.webview,
            this.context,
            document
        );
        this.panel.reveal(vscode.ViewColumn.Beside);
    }

    onDispose(callback: () => void): void {
        this.disposeCallbacks.push(callback);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.panel?.dispose();
        this.panel = undefined;
        this.fileWatcher?.dispose();
        this.syncCoordinator.dispose();
        this.assetService?.dispose();
        for (const d of this.disposables) d.dispose();
        this.disposables = [];
        for (const cb of this.disposeCallbacks) cb();
    }

    private postMessage(message: ExtToWebviewMessage): void {
        this.panel?.webview.postMessage(message);
    }

    private handleMessage(message: WebviewToExtMessage): void {
        switch (message.type) {
            case 'ready':
                this.webviewReady = true;
                this.log.appendLine(
                    `[CanvasPanel] Webview ready. scanReady=${this.scanReady}`
                );
                this.sendInitialData();
                if (this.scanReady) {
                    this.sendAssets();
                }
                break;
            case 'canvasChanged':
                this.handleCanvasChanged(message.json);
                break;
            case 'exportDiagram':
                void this.exportService.exportDiagram(
                    message.format,
                    message.data,
                    this.currentDocument?.uri
                );
                break;
            case 'drillInto':
                void this.handleDrillInto(
                    message.label,
                    message.path,
                    message.calmType
                );
                break;
            case 'drillUp':
                void this.handleDrillUp(message.index, message.filePath);
                break;
            case 'requestStandardProse':
                void this.handleRequestStandardProse(message.url);
                break;
            case 'requestGenerateSpec':
                void this.handleGenerateSpec();
                break;
            case 'saveBuildingBlock':
                void this.handleSaveBuildingBlock(
                    message.filename,
                    message.content
                );
                break;
            case 'requestImportSvg':
                void this.handleImportSvg();
                break;
        }
    }

    private sendInitialData(): void {
        if (!this.currentDocument) return;
        this.postMessage({
            type: 'modelUpdated',
            json: this.currentDocument.getText(),
            source: 'file',
        });
    }

    private sendAssets(): void {
        if (!this.assetService) return;
        const fn = this.assetService.getBuildingBlocks();
        const p = this.assetService.getPatterns();
        const t = this.assetService.getTemplates();
        const s = this.assetService.getStandards();
        this.log.appendLine(
            `[CanvasPanel] Sending assets to webview: ${fn.length} nodes, ${p.length} patterns, ${t.length} templates, ${s.length} standards`
        );
        this.postMessage({ type: 'buildingBlocksLoaded', nodes: fn });
        this.postMessage({ type: 'patternsLoaded', patterns: p });
        this.postMessage({ type: 'templatesLoaded', templates: t });
        this.postMessage({ type: 'standardsLoaded', standards: s });
    }

    /**
     * Restore a breadcrumb level. `index === 0` (or a missing filePath) returns
     * to the root document; any deeper index reloads the building block at
     * `filePath`. Uses `modelUpdated` (not `drillResult`) so the webview does not
     * re-push onto its own drill stack — it has already truncated on navigate.
     */
    private async handleDrillUp(
        index: number,
        filePath?: string
    ): Promise<void> {
        if (index <= 0 || !filePath) {
            if (!this.currentDocument) return;
            this.log.appendLine(
                '[CanvasPanel] drillUp — reloading root document'
            );
            this.postMessage({
                type: 'modelUpdated',
                json: this.currentDocument.getText(),
                source: 'file',
            });
            return;
        }

        try {
            const uri = vscode.Uri.file(filePath);
            const content = await vscode.workspace.fs.readFile(uri);
            const json = Buffer.from(content).toString('utf-8');
            this.log.appendLine(
                `[CanvasPanel] drillUp — reloading level ${index}: ${filePath}`
            );
            this.postMessage({ type: 'modelUpdated', json, source: 'file' });
        } catch {
            this.log.appendLine(
                `[CanvasPanel] drillUp FAILED to reload ${filePath}; falling back to root`
            );
            if (this.currentDocument) {
                this.postMessage({
                    type: 'modelUpdated',
                    json: this.currentDocument.getText(),
                    source: 'file',
                });
            }
        }
    }

    private async handleDrillInto(
        label: string,
        filePath: string,
        calmType: string
    ): Promise<void> {
        this.log.appendLine(
            `[CanvasPanel] drillInto: label="${label}", path="${filePath}", type="${calmType}"`
        );

        const path = await import('path');
        const isReadonly =
            calmType.startsWith('building-block:') ||
            filePath.includes('building-blocks/');

        // Allowed roots for containment check
        const allowedRoots: string[] = [];
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            allowedRoots.push(folder.uri.fsPath);
        }
        const externalPath = vscode.workspace
            .getConfiguration('calm')
            .get<string>('externalAssetsPath');
        if (externalPath?.trim()) allowedRoots.push(path.resolve(externalPath.trim()));

        const isContained = (resolved: string): boolean => {
            const canonical = path.resolve(resolved);
            return allowedRoots.some((root) => canonical.startsWith(root + path.sep) || canonical === root);
        };

        // Strategy: try multiple resolution paths
        const candidates: string[] = [];

        // 1. Try workspace roots (building-blocks are at workspace root level)
        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            candidates.push(path.join(folder.uri.fsPath, filePath));
        }

        // 2. Try relative to current document
        if (this.currentDocument) {
            candidates.push(
                path.resolve(
                    path.dirname(this.currentDocument.uri.fsPath),
                    filePath
                )
            );
        }

        // 3. For building blocks, also search recursively with glob
        const stem = path.basename(filePath, '.calm.json');
        if (filePath.includes('building-blocks/')) {
            for (const folder of vscode.workspace.workspaceFolders ?? []) {
                const pattern = new vscode.RelativePattern(
                    folder,
                    `building-blocks/**/${stem}.calm.json`
                );
                const files = await vscode.workspace.findFiles(
                    pattern,
                    null,
                    1
                );
                if (files.length > 0) {
                    candidates.unshift(files[0].fsPath);
                }
            }
        }

        // Try each candidate (with containment check)
        for (const resolvedPath of candidates) {
            if (!isContained(resolvedPath)) {
                this.log.appendLine(
                    `[CanvasPanel] drillInto BLOCKED path traversal: ${resolvedPath}`
                );
                continue;
            }
            try {
                const uri = vscode.Uri.file(resolvedPath);
                const content = await vscode.workspace.fs.readFile(uri);
                const json = Buffer.from(content).toString('utf-8');

                this.postMessage({
                    type: 'drillResult',
                    json,
                    label,
                    filePath: resolvedPath,
                    readonly: isReadonly,
                });
                this.log.appendLine(
                    `[CanvasPanel] drillInto resolved: ${resolvedPath} (readonly=${isReadonly})`
                );
                return;
            } catch {
                // Try next candidate
            }
        }

        this.log.appendLine(
            `[CanvasPanel] drillInto FAILED: tried ${candidates.length} paths, none found`
        );
        vscode.window.showWarningMessage(`Cannot find: ${filePath}`);
    }

    private async handleRequestStandardProse(url: string): Promise<void> {
        if (!this.assetService) return;
        const prose = await this.assetService.resolveStandardProse(url);
        if (prose) {
            this.postMessage({ type: 'standardProse', url, prose });
        } else {
            this.log.appendLine(
                `[CanvasPanel] Could not resolve standard prose: ${url}`
            );
        }
    }

    private async handleGenerateSpec(): Promise<void> {
        if (!this.currentDocument) return;

        const path = await import('path');
        const filePath = this.currentDocument.uri.fsPath;
        const fileName = path.basename(filePath);
        const baseName = fileName.replace(/\.(calm\.)?json$/, '');
        const sdFileName = `${baseName}-solution-design.md`;
        const sdPath = path.resolve(path.dirname(filePath), sdFileName);

        const standardsContext = await this.collectStandardsContext(
            this.currentDocument.getText()
        );
        const standardsSection =
            standardsContext.length > 0
                ? [
                      ``,
                      `Standards and guidelines that apply (read these for requirements):`,
                      ...standardsContext.map((s) => `---\n${s}\n---`),
                  ]
                : [];

        const prompt = [
            `@CALM Generate a Solution Design document for the architecture at: ${filePath}`,
            ``,
            `Write the output to: ${sdPath}`,
            ``,
            `Instructions:`,
            `- Read the architecture file at the path above`,
            `- Follow the 13-section structure from .github/agents/calm-prompts/solution-design-creation.md`,
            `- ALL diagrams MUST be Mermaid syntax`,
            `- Include ALL 13 sections`,
            ...standardsSection,
        ].join('\n');

        const commands = await vscode.commands.getCommands(true);
        if (commands.includes('workbench.action.chat.open')) {
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: prompt,
                isPartialQuery: false,
                newChat: true,
            });
        } else {
            vscode.window.showWarningMessage(
                'Copilot Chat is not available in this VS Code version.'
            );
        }
    }

    private async collectStandardsContext(archJson: string): Promise<string[]> {
        if (!this.assetService) return [];

        const referencedUrls = new Set<string>();
        try {
            const arch = JSON.parse(archJson) as {
                nodes?: Array<{ controls?: Record<string, unknown> }>;
                controls?: Record<string, unknown>;
            };
            this.extractStandardUrls(arch.nodes ?? [], referencedUrls);
            if (arch.controls) {
                this.extractStandardUrls(
                    [{ controls: arch.controls }],
                    referencedUrls
                );
            }
        } catch {
            /* malformed JSON */
        }

        const prose: string[] = [];
        for (const url of referencedUrls) {
            const resolved = await this.assetService.resolveStandardProse(url);
            if (resolved) prose.push(resolved);
        }
        return prose;
    }

    private extractStandardUrls(
        nodes: Array<{ controls?: Record<string, unknown> }>,
        urls: Set<string>
    ): void {
        for (const node of nodes) {
            if (!node?.controls) continue;
            for (const control of Object.values(node.controls)) {
                const requirements =
                    (
                        control as {
                            requirements?: Array<Record<string, unknown>>;
                        }
                    )?.requirements ?? [];
                for (const req of requirements) {
                    const url = req['requirement-url'];
                    if (typeof url === 'string' && url.endsWith('.md'))
                        urls.add(url);
                }
            }
        }
    }

    private async handleSaveBuildingBlock(
        filename: string,
        content: string
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const buildingBlocksDir = vscode.Uri.joinPath(
            workspaceFolder.uri,
            'building-blocks'
        );
        try {
            await vscode.workspace.fs.stat(buildingBlocksDir);
        } catch {
            await vscode.workspace.fs.createDirectory(buildingBlocksDir);
        }

        const safeName = filename.replace(/[/\\]/g, '');
        if (!safeName || safeName !== filename || filename.includes('..')) {
            vscode.window.showErrorMessage(`Invalid building block filename: ${filename}`);
            return;
        }
        const fileUri = vscode.Uri.joinPath(buildingBlocksDir, safeName);
        try {
            await vscode.workspace.fs.stat(fileUri);
            const overwrite = await vscode.window.showWarningMessage(
                `${filename} already exists. Overwrite?`,
                'Overwrite',
                'Cancel'
            );
            if (overwrite !== 'Overwrite') return;
        } catch {
            /* doesn't exist — good */
        }

        await vscode.workspace.fs.writeFile(
            fileUri,
            Buffer.from(content, 'utf-8')
        );
        vscode.window.showInformationMessage(
            `Building block saved: building-blocks/${filename}`
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    }

    private async handleImportSvg(): Promise<void> {
        this.log.appendLine('[CanvasPanel] handleImportSvg triggered');
        if (!this.importService) {
            this.log.appendLine('[CanvasPanel] importService is undefined');
            return;
        }
        if (!this.currentDocument) {
            this.log.appendLine('[CanvasPanel] currentDocument is undefined');
        }
        const json = await this.importService.importSvgIntoDocument(this.currentDocument);
        if (json) {
            this.log.appendLine(`[CanvasPanel] Import successful, updating webview`);
            this.postMessage({ type: 'modelUpdated', json, source: 'file' });
        } else {
            this.log.appendLine('[CanvasPanel] Import returned null (cancelled or failed)');
        }
    }

    private handleCanvasChanged(json: string): void {
        if (!this.currentDocument) return;
        if (!this.syncCoordinator.canvasChanged()) return;

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            this.currentDocument.positionAt(0),
            this.currentDocument.positionAt(
                this.currentDocument.getText().length
            )
        );
        edit.replace(this.currentDocument.uri, fullRange, json);
        void vscode.workspace.applyEdit(edit);
    }

    private registerFileWatcher(_document: vscode.TextDocument): void {
        this.fileWatcher?.dispose();
        // Watch every CALM document type across the workspace; pushFileToWebview filters to the
        // file this panel is showing. A workspace-wide watcher (rather than one bound to a single
        // file, which VS Code's RelativePattern can't express with a file as its base) keeps
        // working even if the panel is later revealed for a different document.
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            '**/*.{calm.json,architecture.json,solution.json,pattern.json,template.json}'
        );
        this.fileWatcher.onDidChange(
            (uri) => void this.pushFileToWebview(uri),
            null,
            this.disposables
        );
        this.fileWatcher.onDidCreate(
            (uri) => void this.pushFileToWebview(uri),
            null,
            this.disposables
        );

        // In-editor saves are the primary trigger and fire reliably even for documents that live
        // outside the workspace folders (which the file-system watcher above would miss).
        vscode.workspace.onDidSaveTextDocument(
            (doc) => void this.pushFileToWebview(doc.uri),
            null,
            this.disposables
        );
    }

    /**
     * Push the on-disk contents of `uri` to the webview as a file-sourced model update — but only
     * when it is the document this panel is showing and we are not echoing our own canvas write
     * (guarded by the sync coordinator's suppression window).
     */
    private async pushFileToWebview(uri: vscode.Uri): Promise<void> {
        if (!this.currentDocument) return;
        if (uri.fsPath !== this.currentDocument.uri.fsPath) return;
        if (!this.syncCoordinator.fileChanged()) return;
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            this.postMessage({
                type: 'modelUpdated',
                json: Buffer.from(bytes).toString('utf-8'),
                source: 'file',
            });
        } catch {
            /* file removed or unreadable — nothing to sync */
        }
    }
}
