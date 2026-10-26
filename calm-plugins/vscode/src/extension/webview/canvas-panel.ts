import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as nodePath from 'path';
import { getWebviewHtml } from './html-provider';
import { SyncCoordinator } from '../services/sync-coordinator';
import { WorkspaceAssetService } from '../services/workspace-asset-service';
import { DiagramExportService } from '../services/diagram-export-service';
import { HubClient, describeHubError } from '../services/hub-client';
import { HubAssetService, type HubNamespace } from '../services/hub-asset-service';
import { ControlAssetService, LOCAL_DOMAIN } from '../services/control-asset-service';
import { ShaCacheService } from '../services/sha-cache-service';
import { SvgImportService } from '../services/svg-import';
import {
    parseRequirementSchema,
    type ParseResult,
} from '../services/requirement-parser';
import {
    isCanonicalControlUrl,
    isLocalControlPath,
    parseCanonicalControlUrl,
    parseControlCurie,
} from '../services/control-curie';
import { resolveLocalPath, resolveSafeWritePath } from '../services/path-resolver';
import { buildArchitecturePattern } from '../services/pattern-export';
import type {
    ExtToWebviewMessage,
    WebviewToExtMessage,
} from '../types/messages';


function shortHash(input: string): string {
    return crypto.createHash('sha256').update(input.trim().toLowerCase()).digest('hex').slice(0, 8);
}

const describeError = describeHubError;

export class CanvasPanel {
    private panel: vscode.WebviewPanel | undefined;
    private disposables: vscode.Disposable[] = [];
    private disposeCallbacks: Array<() => void> = [];
    private currentDocument: vscode.TextDocument | undefined;
    private syncCoordinator = new SyncCoordinator();
    private assetService: WorkspaceAssetService | undefined;
    private exportService = new DiagramExportService();
    private hubClient: HubClient | undefined;
    private hubAssetService: HubAssetService | undefined;
    private controlAssetService: ControlAssetService;
    private shaCache = new ShaCacheService();
    private hubBaseHash = '';
    private importService: SvgImportService | undefined;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private log: vscode.OutputChannel;

    private disposed = false;
    private scanReady = false;
    private webviewReady = false;
    private hubRefreshing = false;
    /** Resolves once the initial local asset scan completes. */
    private scanReadyPromise: Promise<void> = Promise.resolve();
    private hubReadyPromise: Promise<void> = new Promise<void>(() => {});

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
        this.controlAssetService = new ControlAssetService(
            undefined,
            () => this.assetService?.getControls() ?? []
        );
        this.scanReadyPromise = this.assetService.scanAll().then(() => {
            const fn = this.assetService!.getStandardNodes();
            const p = this.assetService!.getPatterns();
            const c = this.assetService!.getControls();
            this.log.appendLine(
                `[CanvasPanel] Scan complete: ${fn.length} standard-nodes, ${p.length} patterns, ${c.length} controls`
            );
            this.scanReady = true;
            if (this.webviewReady) {
                this.log.appendLine(
                    '[CanvasPanel] Webview was waiting — sending assets now'
                );
                this.sendAssets();
            }
        });
        this.assetService.registerWatchers(context, () => {
            this.sendAssets();
            this.postMessage({ type: 'controlsChanged' });
        });
    }

    async setHubConnection(client?: HubClient, forceRefresh = false): Promise<void> {
        if (!client) {
            this.hubClient = undefined;
            this.hubAssetService = undefined;
            this.hubBaseHash = '';
            this.hubRefreshing = false;
            this.controlAssetService.setHubClient(undefined);
            this.hubReadyPromise = new Promise<void>(() => {});
            this.postMessage({ type: 'hubLoading', loading: false });
            this.log.appendLine('[CanvasPanel] Hub connection cleared');
            this.sendAssets();
            return;
        }

        this.hubClient = client;
        const hubHash = shortHash(client.getBaseUrl());
        this.hubBaseHash = hubHash;
        const service = new HubAssetService(client);
        this.hubAssetService = service;
        this.controlAssetService.setHubClient(client);
        this.hubRefreshing = true;
        this.postMessage({ type: 'hubLoading', loading: true });

        // Assign hubReadyPromise immediately so handlers that fire during
        // cache load / sync don't get the old never-resolving promise.
        this.hubReadyPromise = (async () => {
            if (forceRefresh) {
                await this.shaCache.clearHub(hubHash);
                this.log.appendLine('[CanvasPanel] Cache cleared for clean refresh');
            }

            // Phase 1: Load from cache instantly
            const cached = await this.shaCache.getPalette(hubHash) as HubNamespace[] | null;
            if (cached && cached.length > 0 && !forceRefresh) {
                service.loadFromCache(cached);
                this.log.appendLine(`[CanvasPanel] Loaded ${cached.reduce((n, ns) => n + ns.standardNodes.length, 0)} nodes from cache`);
                this.sendAssets();
            }

            // Phase 2: Delta sync from Hub
            const { changed } = cached && !forceRefresh
                ? await service.deltaRefresh()
                : await service.refresh().then(() => ({ changed: true }));

            // Guard: if a second setHubConnection replaced the service, bail
            if (this.hubAssetService !== service) return;

            const total = service.getNamespaces().reduce((n, ns) => n + ns.standardNodes.length, 0);
            this.log.appendLine(`[CanvasPanel] Hub sync complete: ${total} nodes${changed ? ' (updated)' : ' (no changes)'}`);
            if (changed) this.sendAssets();
            this.shaCache.putPalette(hubHash, service.getNamespaces()).catch(() => {});
        })().catch((err) => {
            this.log.appendLine(`[CanvasPanel] Hub sync failed: ${String(err)}`);
        });

        await this.hubReadyPromise;
        this.hubRefreshing = false;
        this.postMessage({ type: 'hubLoading', loading: false });
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
                // Load Hub cache on ready so palette appears instantly
                if (this.hubClient && this.hubAssetService && this.hubBaseHash) {
                    this.shaCache.getPalette(this.hubBaseHash).then((cached) => {
                        if (cached && this.hubAssetService && this.hubAssetService.getNamespaces().length === 0) {
                            this.hubAssetService.loadFromCache(cached as HubNamespace[]);
                            this.log.appendLine(`[CanvasPanel] Webview ready — loaded ${(cached as HubNamespace[]).reduce((n, ns) => n + ns.standardNodes.length, 0)} nodes from cache`);
                            this.sendAssets();
                        }
                    }).catch(() => {});
                }
                if (this.scanReady) {
                    this.sendAssets();
                }
                if (this.hubRefreshing) {
                    this.postMessage({ type: 'hubLoading', loading: true });
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
            case 'requestGenerateSpec':
                void this.handleGenerateSpec();
                break;
            case 'saveStandardNode':
                void this.handleSaveStandardNode(
                    message.filename,
                    message.content
                );
                break;
            case 'savePattern':
                void this.handleSavePattern(
                    message.filename,
                    message.content
                );
                break;
            case 'requestExportPattern':
                void this.handleExportPattern(message.doc);
                break;
            case 'requestImportSvg':
                void this.handleImportSvg();
                break;
            case 'requestControlBrowse':
                void this.handleControlBrowse(message.requestId);
                break;
            case 'requestControlsForDomain':
                void this.handleControlsForDomain(
                    message.requestId,
                    message.domain
                );
                break;
            case 'requestControlVersions':
                void this.handleControlVersions(
                    message.requestId,
                    message.domain,
                    message.controlName
                );
                break;
            case 'requestControlResolve':
                void this.handleControlResolve(
                    message.requestId,
                    message.ref
                );
                break;
            case 'saveControl':
                void this.handleSaveControl(
                    message.requestId,
                    message.filename,
                    message.content
                );
                break;
            case 'openControlInHub':
                void this.handleOpenControlInHub(message.ref);
                break;
            case 'resolveDefinitionId':
                void this.handleResolveDefinitionId(message.nodeId, message.curie);
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

    public refreshAssets(): void {
        this.sendAssets();
    }

    private sendAssets(): void {
        if (!this.assetService) return;
        const localBlocks = this.assetService.getStandardNodes();
        const localPatterns = this.assetService.getPatterns();

        const allNs = this.hubAssetService?.getNamespaces().map(ns => ns.name) ?? [];
        const userSelection = vscode.workspace.getConfiguration('calm.hub').get<string[]>('selectedNamespaces');
        // VS Code defaults unset arrays to []. Treat null/undefined/[] as "show all".
        const selectedNs = (userSelection && userSelection.length > 0)
            ? allNs.filter(ns => userSelection.includes(ns))
            : allNs;
        const hubBlocks = this.hubAssetService?.getAllStandardNodes(selectedNs) ?? [];
        const hubPatterns = this.hubAssetService?.getAllPatterns(selectedNs) ?? [];

        const allBlocks = [...localBlocks, ...hubBlocks];
        const allPatterns = [...localPatterns, ...hubPatterns];

        this.log.appendLine(
            `[CanvasPanel] Sending assets to webview: ${allBlocks.length} nodes (${localBlocks.length} local + ${hubBlocks.length} hub), ${allPatterns.length} patterns`
        );
        this.postMessage({ type: 'standardNodesLoaded', nodes: allBlocks });
        this.postMessage({ type: 'patternsLoaded', patterns: allPatterns });
    }

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

        const isReadonly =
            calmType.startsWith('standard-node:') ||
            filePath.includes('standard-nodes/');

        const workspaceRoots = (vscode.workspace.workspaceFolders ?? []).map(f => f.uri.fsPath);
        const externalPath = vscode.workspace
            .getConfiguration('calm')
            .get<string>('externalAssetsPath');

        // Try resolveLocalPath first (handles containment + symlink checks)
        const resolved = resolveLocalPath(filePath, workspaceRoots, externalPath);
        if (!resolved) {
            // Also try relative to current document
            const docDir = this.currentDocument ? nodePath.dirname(this.currentDocument.uri.fsPath) : undefined;
            const fromDoc = docDir ? resolveLocalPath(filePath, [docDir]) : null;

            // Glob search for standard-nodes
            let fromGlob: string | null = null;
            if (!fromDoc && filePath.includes('standard-nodes/')) {
                const stem = nodePath.basename(filePath, '.calm.json');
                for (const folder of vscode.workspace.workspaceFolders ?? []) {
                    const pattern = new vscode.RelativePattern(folder, `standard-nodes/**/${stem}.calm.json`);
                    const files = await vscode.workspace.findFiles(pattern, null, 1);
                    if (files.length > 0) {
                        fromGlob = resolveLocalPath(
                            nodePath.relative(folder.uri.fsPath, files[0].fsPath),
                            [folder.uri.fsPath]
                        );
                        if (fromGlob) break;
                    }
                }
            }

            const target = fromDoc ?? fromGlob;
            if (!target) {
                this.log.appendLine(`[CanvasPanel] drillInto FAILED: no safe resolution for "${filePath}"`);
                vscode.window.showWarningMessage(`Cannot find: ${filePath}`);
                return;
            }
            return this.drillIntoFile(target, label, isReadonly);
        }
        return this.drillIntoFile(resolved, label, isReadonly);
    }

    private async drillIntoFile(resolvedPath: string, label: string, readonly: boolean): Promise<void> {
        try {
            const uri = vscode.Uri.file(resolvedPath);
            const content = await vscode.workspace.fs.readFile(uri);
            const json = Buffer.from(content).toString('utf-8');
            this.postMessage({ type: 'drillResult', json, label, filePath: resolvedPath, readonly });
            this.log.appendLine(`[CanvasPanel] drillInto resolved: ${resolvedPath} (readonly=${readonly})`);
        } catch {
            vscode.window.showWarningMessage(`Cannot read: ${resolvedPath}`);
        }
    }

    private async handleGenerateSpec(): Promise<void> {
        if (!this.currentDocument) return;

        const filePath = this.currentDocument.uri.fsPath;
        const fileName = nodePath.basename(filePath);
        const baseName = fileName.replace(/\.(calm\.)?json$/, '');
        const sdFileName = `${baseName}-solution-design.md`;
        const sdPath = nodePath.resolve(nodePath.dirname(filePath), sdFileName);

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



    private async handleSaveStandardNode(
        filename: string,
        content: string
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const standardNodesDir = vscode.Uri.joinPath(
            workspaceFolder.uri,
            'standard-nodes'
        );
        try {
            await vscode.workspace.fs.stat(standardNodesDir);
        } catch {
            await vscode.workspace.fs.createDirectory(standardNodesDir);
        }

        const writePath = resolveSafeWritePath(`standard-nodes/${filename}`, workspaceFolder.uri.fsPath);
        if (!writePath) {
            vscode.window.showErrorMessage(`Invalid standard node filename: ${filename}`);
            return;
        }
        const fileUri = vscode.Uri.file(writePath);
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
            `Standard node saved: standard-nodes/${filename}`
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        await this.assetService?.scanAll();
        this.sendAssets();
    }

    private async handleSavePattern(
        filename: string,
        content: string
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open.');
            return;
        }

        const patternsDir = vscode.Uri.joinPath(
            workspaceFolder.uri,
            'patterns'
        );
        try {
            await vscode.workspace.fs.stat(patternsDir);
        } catch {
            await vscode.workspace.fs.createDirectory(patternsDir);
        }

        const writePath = resolveSafeWritePath(`patterns/${filename}`, workspaceFolder.uri.fsPath);
        if (!writePath) {
            vscode.window.showErrorMessage(`Invalid pattern filename: ${filename}`);
            return;
        }
        const fileUri = vscode.Uri.file(writePath);
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
            `Pattern saved: patterns/${filename}`
        );

        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        await this.assetService?.scanAll();
        this.sendAssets();
    }

    private async handleExportPattern(docJson: string): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: 'Pattern name',
            placeHolder: 'e.g. My Service Pattern',
        });
        if (!name?.trim()) return;

        let doc: Record<string, unknown>;
        try {
            doc = JSON.parse(docJson);
        } catch {
            vscode.window.showErrorMessage('Cannot export pattern: invalid document JSON');
            return;
        }
        const { fileName, json } = buildArchitecturePattern(doc, name);
        await this.handleSavePattern(fileName, json);
    }

    /** Local controls are always available; Hub domains are fetched lazily per-domain. */
    private async handleControlBrowse(requestId: string): Promise<void> {
        try {
            await this.scanReadyPromise;
            const groups = await this.controlAssetService.browse();
            this.postMessage({
                type: 'controlBrowseResult',
                requestId,
                ok: true,
                groups,
            });
        } catch (err) {
            this.postMessage({
                type: 'controlBrowseResult',
                requestId,
                ok: false,
                error: describeError(err),
            });
        }
    }

    private async handleControlsForDomain(
        requestId: string,
        domain: string
    ): Promise<void> {
        try {
            await this.scanReadyPromise;
            if (domain !== LOCAL_DOMAIN) {
                const hubReady = this.hubReadyPromise;
                if (!this.hubClient) {
                    this.postMessage({ type: 'controlDomainResult', requestId, ok: false, error: 'Hub not connected' });
                    return;
                }
                await hubReady;
            }
            const group = await this.controlAssetService.browseControlsForDomain(domain);
            if (group.error) {
                this.postMessage({ type: 'controlDomainResult', requestId, ok: false, error: group.error });
            } else {
                this.postMessage({ type: 'controlDomainResult', requestId, ok: true, group });
            }
        } catch (err) {
            this.postMessage({ type: 'controlDomainResult', requestId, ok: false, error: describeError(err) });
        }
    }

    private async handleControlVersions(
        requestId: string,
        domain: string,
        controlName: string
    ): Promise<void> {
        if (domain === LOCAL_DOMAIN) {
            this.postMessage({ type: 'controlVersionsResult', requestId, ok: true, versions: ['current'] });
            return;
        }
        const client = this.hubClient;
        if (!client) {
            this.postMessage({ type: 'controlVersionsResult', requestId, ok: false, error: 'Hub not connected' });
            return;
        }
        try {
            const hubReady = this.hubReadyPromise;
            await hubReady;
            const resolved = await client.resolveControlId(domain, controlName);
            const versions = await client.getRequirementVersions(resolved.domain, resolved.id);
            this.postMessage({ type: 'controlVersionsResult', requestId, ok: true, versions });
        } catch (err) {
            this.postMessage({ type: 'controlVersionsResult', requestId, ok: false, error: describeError(err) });
        }
    }

    private async handleControlResolve(
        requestId: string,
        ref: string
    ): Promise<void> {
        try {
            if (isLocalControlPath(ref)) {
                await this.scanReadyPromise;
                this.postResolve(requestId, await this.resolveLocalRequirement(ref));
                return;
            }

            const parts = isCanonicalControlUrl(ref)
                ? parseCanonicalControlUrl(ref)
                : parseControlCurie(ref);
            if (!parts) {
                this.postMessage({
                    type: 'controlResolveResult',
                    requestId,
                    ok: false,
                    error: 'Unrecognized or invalid control reference',
                });
                return;
            }

            // Local fallback: match by slug against scanned workspace controls.
            await this.scanReadyPromise;
            const localResult = await this.resolveLocalControlBySlug(parts.controlName);
            if (localResult) {
                this.postResolve(requestId, localResult);
                return;
            }

            // Hub resolution: fetch the requirement schema from Hub
            if (this.hubClient) {
                try {
                    const resolved = await this.hubClient.resolveControlId(parts.domain, parts.controlName);
                    const versions = await this.hubClient.getRequirementVersions(resolved.domain, resolved.id);
                    const version = parts.version ?? (versions.length > 0 ? versions[versions.length - 1] : undefined);
                    if (version) {
                        const schema = await this.hubClient.getRequirementAtVersion(resolved.domain, resolved.id, version);
                        if (schema && typeof schema === 'object') {
                            const fallback = { controlId: parts.controlName, name: parts.controlName, description: parts.controlName };
                            const result = parseRequirementSchema(schema as Record<string, unknown>, fallback);
                            this.postResolve(requestId, result);
                            return;
                        }
                    }
                } catch { /* fall through to error */ }
            }

            this.postMessage({
                type: 'controlResolveResult',
                requestId,
                ok: false,
                error: this.hubClient
                    ? `Control "${parts.controlName}" not found in domain "${parts.domain}"`
                    : `Control "${parts.controlName}" not found locally (Hub not connected)`,
            });
        } catch (err) {
            this.postMessage({
                type: 'controlResolveResult',
                requestId,
                ok: false,
                error: describeError(err),
            });
        }
    }

    private postResolve(requestId: string, result: ParseResult): void {
        if (!result.parsed) {
            this.postMessage({
                type: 'controlResolveResult',
                requestId,
                ok: false,
                error: result.warnings[0] ?? 'Malformed requirement schema',
            });
            return;
        }
        this.postMessage({
            type: 'controlResolveResult',
            requestId,
            ok: true,
            parsed: result.parsed,
            warnings: result.warnings,
        });
    }

    private async resolveLocalControlBySlug(slug: string): Promise<ParseResult | null> {
        const controls = this.assetService?.getControls() ?? [];
        const match = controls.find((c) => c.id === slug);
        if (!match) return null;
        const bytes = await vscode.workspace.fs.readFile(
            vscode.Uri.file(match.filePath)
        );
        const schema = JSON.parse(Buffer.from(bytes).toString('utf-8'));
        const fallbackIdentity = {
            controlId: match.controlId,
            name: match.name,
            description: match.description,
        };
        return parseRequirementSchema(schema, fallbackIdentity);
    }

    private async resolveLocalRequirement(ref: string): Promise<ParseResult> {
        const roots = (vscode.workspace.workspaceFolders ?? []).map(
            (f) => f.uri.fsPath
        );
        const externalPath = vscode.workspace
            .getConfiguration('calm')
            .get<string>('externalAssetsPath');
        const abs = resolveLocalPath(
            ref,
            roots,
            externalPath?.trim() || undefined
        );
        if (!abs) {
            return {
                parsed: null,
                warnings: [`Control file not found or outside workspace: ${ref}`],
            };
        }
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
        const schema = JSON.parse(Buffer.from(bytes).toString('utf-8'));
        const stem = nodePath.basename(abs).replace(/(\.requirement)?\.json$/, '');
        const fallbackIdentity = { controlId: stem, name: stem, description: stem };
        return parseRequirementSchema(schema, fallbackIdentity);
    }

    private async handleSaveControl(
        requestId: string,
        filename: string,
        content: string
    ): Promise<void> {
        try {
            await this.scanReadyPromise;

            if (
                !/^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.requirement)?\.json$/.test(filename)
            ) {
                this.postSaveError(requestId, `Invalid control filename: ${filename}`);
                return;
            }

            let schema: Record<string, unknown>;
            try {
                schema = JSON.parse(content);
            } catch {
                this.postSaveError(requestId, 'Control content is not valid JSON');
                return;
            }

            const idVal = typeof schema.$id === 'string' ? schema.$id : '';
            const curieParts = parseControlCurie(idVal);
            const domain = curieParts?.domain;

            const stem = filename.replace(/(\.requirement)?\.json$/, '');
            const fallbackIdentity = { controlId: stem, name: stem, description: stem };
            const { parsed, warnings } = parseRequirementSchema(schema, fallbackIdentity);
            if (!parsed) {
                this.postSaveError(
                    requestId,
                    warnings[0] ?? 'Malformed requirement schema'
                );
                return;
            }

            const targetRoot = this.getDocumentWorkspaceRoot();
            if (!targetRoot) {
                this.postSaveError(requestId, 'No workspace folder open');
                return;
            }

            const subDir = domain ? `controls/${domain}` : 'controls';
            const controlsDir = vscode.Uri.joinPath(
                vscode.Uri.file(targetRoot),
                subDir
            );
            try {
                await vscode.workspace.fs.stat(controlsDir);
            } catch {
                await vscode.workspace.fs.createDirectory(controlsDir);
            }

            const writePath = resolveSafeWritePath(
                `${subDir}/${filename}`,
                targetRoot
            );
            if (!writePath) {
                this.postSaveError(requestId, 'Unsafe control path');
                return;
            }
            const fileUri = vscode.Uri.file(writePath);

            try {
                await vscode.workspace.fs.stat(fileUri);
                const choice = await vscode.window.showWarningMessage(
                    `${filename} already exists. Overwrite?`,
                    'Overwrite',
                    'Cancel'
                );
                if (choice !== 'Overwrite') {
                    this.postSaveError(requestId, 'cancelled');
                    return;
                }
            } catch {
                /* doesn't exist — good */
            }

            await vscode.workspace.fs.writeFile(
                fileUri,
                Buffer.from(content, 'utf-8')
            );

            await this.assetService!.scanAll();
            this.sendAssets();
            this.postMessage({ type: 'saveControlResult', requestId, ok: true });
        } catch (err) {
            this.postSaveError(requestId, describeError(err));
        }
    }

    private postSaveError(requestId: string, error: string): void {
        this.postMessage({ type: 'saveControlResult', requestId, ok: false, error });
    }

    private getDocumentWorkspaceRoot(): string | undefined {
        const folders = vscode.workspace.workspaceFolders ?? [];
        const docPath = this.currentDocument?.uri.fsPath;
        if (docPath) {
            for (const f of folders) {
                const root = f.uri.fsPath;
                if (docPath === root || docPath.startsWith(root + nodePath.sep)) {
                    return root;
                }
            }
        }
        return folders[0]?.uri.fsPath;
    }

    private async handleOpenControlInHub(ref: string): Promise<void> {
        if (!this.hubClient) {
            vscode.window.showWarningMessage('Hub not connected');
            return;
        }
        const baseUrl = this.hubClient.getBaseUrl();
        const parsed = parseControlCurie(ref) ?? parseCanonicalControlUrl(ref);
        if (parsed) {
            try {
                const resolved = await this.hubClient.resolveControlId(parsed.domain, parsed.controlName);
                const url = `${baseUrl}/#/${encodeURIComponent(resolved.domain)}/controls/${resolved.id}/detail`;
                vscode.env.openExternal(vscode.Uri.parse(url));
            } catch {
                const url = `${baseUrl}/#/domain/${encodeURIComponent(parsed.domain)}`;
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        }
    }

    private async pinControlVersions(controls: Record<string, unknown>): Promise<void> {
        if (this.hubAssetService) {
            await this.hubAssetService.pinControlVersions(controls);
        }
    }

    private async handleResolveDefinitionId(nodeId: string, curie: string): Promise<void> {
        const client = this.hubClient;
        if (!client) {
            this.postMessage({ type: 'definitionResolutionFailed', nodeId, error: 'Hub not connected' });
            return;
        }
        try {
            const hubReady = this.hubReadyPromise;
            await hubReady;
            const atIdx = curie.lastIndexOf('@');
            if (atIdx === -1) {
                this.postMessage({ type: 'definitionResolutionFailed', nodeId, error: `CURIE missing version: ${curie}` });
                return;
            }
            const version = curie.slice(atIdx + 1);
            const head = curie.slice(0, atIdx);
            const segments = head.split(':');
            if (segments.length < 3) {
                this.postMessage({ type: 'definitionResolutionFailed', nodeId, error: `Invalid CURIE: ${curie}` });
                return;
            }
            const [namespace, , resourceName] = segments;

            // Cache first — SHA-based versions are immutable, so cached data is always valid.
            const cached = await this.shaCache.get(this.hubBaseHash, namespace, 'standards', resourceName, version);
            if (cached) {
                this.postMessage({ type: 'definitionResolved', nodeId, controls: cached as Record<string, unknown> });
                return;
            }

            // Look up the numeric Hub ID from the cached namespace data
            let numericId: string = resourceName;
            if (this.hubAssetService) {
                const ns = this.hubAssetService.getNamespaces().find(n => n.name === namespace);
                const match = ns?.standardNodes.find(sn => sn.id === resourceName);
                if (match?.hubId != null) numericId = String(match.hubId);
            }
            const doc = await client.getResourceAtVersion(
                namespace,
                'standards',
                numericId,
                version
            ) as Record<string, unknown>;
            const docNodes = (doc.nodes as Array<Record<string, unknown>>) ?? [];
            const docNode = docNodes[0];
            const controls = (docNode?.controls as Record<string, unknown>) ?? {};
            await this.pinControlVersions(controls);
            this.postMessage({ type: 'definitionResolved', nodeId, controls });
            this.shaCache.put(this.hubBaseHash, namespace, 'standards', resourceName, version, controls).catch(() => {});
        } catch (err) {
            this.postMessage({ type: 'definitionResolutionFailed', nodeId, error: describeError(err) });
        }
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
            this.log.appendLine('[CanvasPanel] Import successful, updating webview');
            this.postMessage({ type: 'modelUpdated', json, source: 'import' });
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

        vscode.workspace.onDidSaveTextDocument(
            (doc) => void this.pushFileToWebview(doc.uri),
            null,
            this.disposables
        );
    }

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
