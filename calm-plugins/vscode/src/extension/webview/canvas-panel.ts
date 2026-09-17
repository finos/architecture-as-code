import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as nodePath from 'path';
import { getWebviewHtml } from './html-provider';
import { SyncCoordinator } from '../services/sync-coordinator';
import { WorkspaceAssetService } from '../services/workspace-asset-service';
import { DiagramExportService } from '../services/diagram-export-service';
import { HubClient, HubApiError } from '../services/hub-client';
import { HubAssetService } from '../services/hub-asset-service';
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
    type ControlCurieResult,
} from '../services/control-curie';
import { resolveLocalPath, resolveSafeWritePath } from '../services/path-resolver';
import type {
    ExtToWebviewMessage,
    WebviewToExtMessage,
} from '../types/messages';

/**
 * Parse a CURIE of the form `namespace:type:slug@version` into its components.
 * Exported for unit testing.
 */
export function parseCurie(curie: string): {
    namespace: string;
    type: string;
    slug: string;
    version: string | undefined;
} {
    const parts = curie.split(':');
    const namespace = parts[0] ?? '';
    const type = parts[1] ?? '';
    const slugAndVersion = parts.slice(2).join(':');
    const atIndex = slugAndVersion.indexOf('@');
    const slug =
        atIndex === -1 ? slugAndVersion : slugAndVersion.substring(0, atIndex);
    const version =
        atIndex === -1 ? undefined : slugAndVersion.substring(atIndex + 1);
    return { namespace, type, slug, version };
}

/**
 * Pin unversioned control CURIEs in requirement-url fields with the parent's SHA.
 * A CURIE has the form `ns:type:slug` — if it lacks `@version`, append `@sha`.
 * Exported for unit testing.
 */
export function pinControlCuries(
    controls: Record<string, unknown>,
    sha: string
): Record<string, unknown> {
    const pinned: Record<string, unknown> = {};
    for (const [key, ctrl] of Object.entries(controls)) {
        if (!ctrl || typeof ctrl !== 'object') {
            pinned[key] = ctrl;
            continue;
        }
        const c = ctrl as Record<string, unknown>;
        const reqs = c.requirements as Array<Record<string, unknown>> | undefined;
        if (!reqs?.length) {
            pinned[key] = ctrl;
            continue;
        }
        const pinnedReqs = reqs.map((req) => {
            const url = req['requirement-url'];
            if (typeof url !== 'string') return req;
            // Control CURIEs (`domain:controls:name`) carry their own independent
            // version and must never be pinned with the parent building-block SHA.
            if (url.includes(':controls:')) return req;
            // Already versioned or not a CURIE (no colons)
            if (url.includes('@') || (url.match(/:/g) ?? []).length < 2) return req;
            return { ...req, 'requirement-url': `${url}@${sha}` };
        });
        pinned[key] = { ...c, requirements: pinnedReqs };
    }
    return pinned;
}

/** First 8 hex chars of the SHA-256 of the normalized (lower-cased) base URL. */
function shortHash(input: string): string {
    return crypto
        .createHash('sha256')
        .update(input.trim().toLowerCase())
        .digest('hex')
        .slice(0, 8);
}

/** Human-readable message for a caught error, with a friendly 403 for Hub calls. */
function describeError(err: unknown): string {
    if (err instanceof HubApiError) {
        if (err.status === 403) return 'Access denied (403)';
        return `Hub request failed (${err.status})`;
    }
    return err instanceof Error ? err.message : String(err);
}

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
    /** Resolves once the initial local asset scan completes. */
    private scanReadyPromise: Promise<void> = Promise.resolve();
    /** Resolves once an authenticated Hub client is connected and refreshed. Never resolves while disconnected. */
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
        // The Hub client is owned by extension.ts and injected via
        // setHubConnection(); the panel never creates one itself.
        this.controlAssetService = new ControlAssetService(
            undefined,
            () => this.assetService?.getControls() ?? []
        );
        this.scanReadyPromise = this.assetService.scanAll().then(() => {
            const fn = this.assetService!.getBuildingBlocks();
            const p = this.assetService!.getPatterns();
            const t = this.assetService!.getTemplates();
            const s = this.assetService!.getStandards();
            const c = this.assetService!.getControls();
            this.log.appendLine(
                `[CanvasPanel] Scan complete: ${fn.length} building-blocks, ${p.length} patterns, ${t.length} templates, ${s.length} standards, ${c.length} controls`
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
        this.assetService.registerWatchers(context, () => {
            this.sendAssets();
            // A local requirement file may have changed — ask the webview to
            // re-resolve affected controls.
            this.postMessage({ type: 'controlsChanged' });
        });
    }

    /**
     * Inject (or clear) the authenticated Hub client. This is the sole way the
     * panel gains Hub access — extension.ts owns the client and calls this on
     * connect, disconnect, refresh, and when a panel opens while already
     * connected. Passing `undefined` tears the connection down.
     */
    async setHubConnection(client?: HubClient): Promise<void> {
        if (!client) {
            this.hubClient = undefined;
            this.hubAssetService = undefined;
            this.hubBaseHash = '';
            this.controlAssetService.setHubClient(undefined);
            // A never-resolving promise (not a rejected one) avoids
            // unhandled-rejection noise; handlers check `hubClient` first.
            this.hubReadyPromise = new Promise<void>(() => {});
            this.log.appendLine('[CanvasPanel] Hub connection cleared');
            this.sendAssets();
            return;
        }

        this.hubClient = client;
        this.hubBaseHash = shortHash(client.getBaseUrl());
        this.hubAssetService = new HubAssetService(client);
        this.controlAssetService.setHubClient(client);
        // Refresh Hub assets so sendAssets() posts fresh Hub data. The `.catch`
        // keeps the promise resolving even on failure so awaiting handlers never
        // hang.
        this.hubReadyPromise = this.hubAssetService
            .refresh()
            .then(() => {
                this.log.appendLine(
                    `[CanvasPanel] Hub asset refresh complete: ${this.hubAssetService!.getNamespaces().reduce((n, ns) => n + ns.buildingBlocks.length, 0)} blocks`
                );
            })
            .catch((err) => {
                this.log.appendLine(
                    `[CanvasPanel] Hub asset refresh failed: ${String(err)}`
                );
            });
        await this.hubReadyPromise;
        this.sendAssets();
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
            case 'savePattern':
                void this.handleSavePattern(
                    message.filename,
                    message.content
                );
                break;
            case 'requestExportPattern':
                void this.handleExportPattern(message.doc);
                break;
            case 'resolveDefinitionId':
                void this.handleResolveDefinitionId(
                    message.nodeId,
                    message.curie
                );
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
        }
    }

    private sendInitialData(): void {
        if (!this.currentDocument) return;
        this.postMessage({
            type: 'modelUpdated',
            json: this.currentDocument.getText(),
            source: 'file',
        });
        // Kick off update check after initial data is sent
        void this.checkForUpdates();
    }

    public refreshAssets(): void {
        this.sendAssets();
    }

    private sendAssets(): void {
        if (!this.assetService) return;
        const localBlocks = this.assetService.getBuildingBlocks();
        const localPatterns = this.assetService.getPatterns();
        const t = this.assetService.getTemplates();
        const s = this.assetService.getStandards();

        // Merge Hub-sourced assets — only show explicitly selected namespaces
        const selectedNs: string[] = vscode.workspace
            .getConfiguration('calm.hub')
            .get<string[]>('selectedNamespaces') ?? [];
        const hubBlocks = this.hubAssetService?.getAllBuildingBlocks(selectedNs) ?? [];
        const hubStandards = this.hubAssetService?.getAllStandards(selectedNs) ?? [];
        const hubPatterns = this.hubAssetService?.getAllPatterns(selectedNs) ?? [];
        const hubAdrs = this.hubAssetService?.getAllAdrs(selectedNs) ?? [];
        const allBlocks = [...localBlocks, ...hubBlocks, ...hubStandards];
        const allPatterns = [...localPatterns, ...hubPatterns];

        this.log.appendLine(
            `[CanvasPanel] Sending assets to webview: ${allBlocks.length} nodes (${localBlocks.length} local + ${hubBlocks.length} hub blocks + ${hubStandards.length} hub standards), ${allPatterns.length} patterns (${localPatterns.length} local + ${hubPatterns.length} hub), ${t.length} templates, ${s.length} standards, ${hubAdrs.length} ADRs`
        );
        this.postMessage({ type: 'buildingBlocksLoaded', nodes: allBlocks });
        this.postMessage({ type: 'patternsLoaded', patterns: allPatterns });
        this.postMessage({ type: 'templatesLoaded', templates: t });
        this.postMessage({ type: 'standardsLoaded', standards: s });
        this.postMessage({ type: 'adrsLoaded', adrs: hubAdrs });
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

        const safeName = filename.replace(/[/\\]/g, '');
        if (!safeName || safeName !== filename || filename.includes('..')) {
            vscode.window.showErrorMessage(`Invalid pattern filename: ${filename}`);
            return;
        }
        const fileUri = vscode.Uri.joinPath(patternsDir, safeName);
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

        const doc = JSON.parse(docJson);
        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const fileName = `${slug}.pattern.json`;

        const toSchema = (value: unknown): unknown => {
            if (value === null || value === undefined) return undefined;
            if (Array.isArray(value)) return { type: 'array', prefixItems: value.map(toSchema) };
            if (typeof value === 'object') {
                const props: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
                    if (k === '$schema' || k === '$id' || k === 'type') continue;
                    const s = toSchema(v);
                    if (s !== undefined) props[k] = s;
                }
                return { type: 'object', properties: props };
            }
            return { const: value };
        };
        const itemSchema = (entry: Record<string, unknown>, ref: string) => {
            const props: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(entry)) {
                if (k === '$schema' || k === '$id' || k === 'type' || v === undefined) continue;
                props[k] = toSchema(v);
            }
            return { $ref: ref, type: 'object', properties: props };
        };

        const nodes = (doc.nodes ?? []) as Record<string, unknown>[];
        const rels = (doc.relationships ?? []) as Record<string, unknown>[];
        const pattern = {
            $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
            $id: `patterns/${fileName}`,
            type: 'object',
            title: name.trim(),
            description: `Pattern derived from architecture: ${name.trim()}`,
            properties: {
                nodes: {
                    type: 'array',
                    minItems: nodes.length,
                    prefixItems: nodes.map((n) =>
                        itemSchema(n, 'https://calm.finos.org/release/1.2/meta/core.json#/defs/node')
                    ),
                },
                relationships: {
                    type: 'array',
                    minItems: rels.length,
                    prefixItems: rels.map((r) =>
                        itemSchema(r, 'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship')
                    ),
                },
            },
            required: ['nodes', 'relationships'],
        };

        await this.handleSavePattern(fileName, JSON.stringify(pattern, null, 2));
    }

    private async handleResolveDefinitionId(
        nodeId: string,
        curie: string
    ): Promise<void> {
        this.log.appendLine(
            `[CanvasPanel] resolveDefinitionId: nodeId="${nodeId}", curie="${curie}"`
        );
        try {
            const { namespace, type, slug, version } = parseCurie(curie);
            if (this.hubClient && version) {
                // Check SHA cache first for offline-capable resolution
                const cached = await this.shaCache.get(
                    namespace,
                    type,
                    slug,
                    version
                );
                if (cached) {
                    const rawControls =
                        (
                            cached as {
                                nodes?: Array<{
                                    controls?: Record<string, unknown>;
                                }>;
                            }
                        )?.nodes?.[0]?.controls ?? {};
                    const controls = pinControlCuries(rawControls, version);
                    this.postMessage({
                        type: 'definitionResolved',
                        nodeId,
                        controls,
                    });
                    this.log.appendLine(
                        `[CanvasPanel] definitionResolved (cache hit): nodeId="${nodeId}", controls=${Object.keys(controls).length} keys`
                    );
                    return;
                }

                // Cache miss — fetch from Hub, then cache
                const content = (await this.hubClient.getResourceAtVersion(
                    namespace,
                    type,
                    slug,
                    version
                )) as { nodes?: Array<{ controls?: Record<string, unknown> }> };

                await this.shaCache.put(
                    namespace,
                    type,
                    slug,
                    version,
                    content
                );

                const rawControls = content?.nodes?.[0]?.controls ?? {};
                const controls = pinControlCuries(rawControls, version);
                this.postMessage({
                    type: 'definitionResolved',
                    nodeId,
                    controls,
                });
                this.log.appendLine(
                    `[CanvasPanel] definitionResolved (fetched + cached): nodeId="${nodeId}", controls=${Object.keys(controls).length} keys`
                );
            } else {
                this.postMessage({
                    type: 'definitionResolutionFailed',
                    nodeId,
                    error: 'Hub client not connected or no version in CURIE',
                });
            }
        } catch (error) {
            this.postMessage({
                type: 'definitionResolutionFailed',
                nodeId,
                error: String(error),
            });
            this.log.appendLine(
                `[CanvasPanel] definitionResolutionFailed: nodeId="${nodeId}", error="${String(error)}"`
            );
        }
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
        if (!this.hubClient) {
            this.postMessage({
                type: 'controlDomainResult',
                requestId,
                ok: false,
                error: 'Hub not connected',
            });
            return;
        }
        try {
            await this.hubReadyPromise;
            const group =
                await this.controlAssetService.browseControlsForDomain(domain);
            this.postMessage({
                type: 'controlDomainResult',
                requestId,
                ok: true,
                group,
            });
        } catch (err) {
            this.postMessage({
                type: 'controlDomainResult',
                requestId,
                ok: false,
                error: describeError(err),
            });
        }
    }

    private async handleControlVersions(
        requestId: string,
        domain: string,
        controlName: string
    ): Promise<void> {
        // Local controls have a single implicit "current" version.
        if (domain === LOCAL_DOMAIN) {
            this.postMessage({
                type: 'controlVersionsResult',
                requestId,
                ok: true,
                versions: ['current'],
            });
            return;
        }
        if (!this.hubClient) {
            this.postMessage({
                type: 'controlVersionsResult',
                requestId,
                ok: false,
                error: 'Hub not connected',
            });
            return;
        }
        try {
            await this.hubReadyPromise;
            const resolved = await this.hubClient.resolveControlId(domain, controlName);
            const versions = await this.hubClient.getRequirementVersions(
                resolved.domain,
                resolved.id
            );
            this.postMessage({
                type: 'controlVersionsResult',
                requestId,
                ok: true,
                versions,
            });
        } catch (err) {
            this.postMessage({
                type: 'controlVersionsResult',
                requestId,
                ok: false,
                error: describeError(err),
            });
        }
    }

    /**
     * Classify and resolve a control reference to its parsed requirement. The
     * webview never constructs URLs — it passes the raw ref and the extension
     * classifies (canonical URL → CURIE → local path) and resolves securely.
     */
    private async handleControlResolve(
        requestId: string,
        ref: string
    ): Promise<void> {
        try {
            // Local path — resolve from disk, no Hub needed.
            if (isLocalControlPath(ref)) {
                await this.scanReadyPromise;
                this.postResolve(requestId, await this.resolveLocalRequirement(ref));
                return;
            }

            // Hub ref (canonical URL or CURIE).
            const parts = isCanonicalControlUrl(ref)
                ? this.parseAndValidateCanonicalUrl(ref)
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

            // Cache-first: check the SHA cache before awaiting Hub readiness so a
            // cache hit resolves even while offline.
            const cached = await this.getCachedRequirement(parts);
            if (cached) {
                this.postResolve(requestId, parseRequirementSchema(cached));
                return;
            }

            // Try Hub when a client is available.
            let hubError: unknown;
            if (this.hubClient) {
                try {
                    await this.hubReadyPromise;
                    const resolved = await this.hubClient.resolveControlId(
                        parts.domain,
                        parts.controlName
                    );
                    // Auto-resolve to latest version when the CURIE is unversioned.
                    let version = parts.version;
                    if (!version) {
                        const versions = await this.hubClient.getRequirementVersions(
                            resolved.domain,
                            resolved.id
                        );
                        version = versions[versions.length - 1];
                    }
                    if (!version) throw new Error('No versions available');
                    const schema = await this.hubClient.getRequirementAtVersion(
                        resolved.domain,
                        resolved.id,
                        version
                    );
                    const resolvedParts = { ...parts, version };
                    await this.putCachedRequirement(resolvedParts, schema);
                    const s = schema as Record<string, unknown>;
                    const fallbackIdentity = {
                        controlId: parts.controlName,
                        name: typeof s.title === 'string' ? s.title : parts.controlName,
                        description: typeof s.description === 'string' ? s.description : parts.controlName,
                    };
                    this.postResolve(requestId, parseRequirementSchema(schema, fallbackIdentity));
                    return;
                } catch (err) {
                    hubError = err;
                    this.log.appendLine(
                        `[CanvasPanel] Hub control resolve failed for ${parts.domain}/${parts.controlName}: ${err instanceof Error ? err.message : String(err)}`
                    );
                }
            }

            // Local fallback: match by slug against scanned workspace controls.
            await this.scanReadyPromise;
            const localResult = await this.resolveLocalControlBySlug(parts.controlName);
            if (localResult) {
                this.postResolve(requestId, localResult);
                return;
            }

            this.postMessage({
                type: 'controlResolveResult',
                requestId,
                ok: false,
                error: hubError
                    ? describeError(hubError)
                    : `Control "${parts.controlName}" not found on Hub or locally`,
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

    /** Verify a canonical URL originates from the configured Hub before trusting it. */
    private parseAndValidateCanonicalUrl(
        ref: string
    ): ControlCurieResult | null {
        const parts = parseCanonicalControlUrl(ref);
        if (!parts || !this.hubClient) return null;
        try {
            const refUrl = new URL(ref);
            const baseUrl = new URL(this.hubClient.getBaseUrl());
            if (refUrl.origin !== baseUrl.origin) return null;
            const basePath = baseUrl.pathname.replace(/\/$/, '');
            if (!refUrl.pathname.startsWith(`${basePath}/calm/domains/`)) {
                return null;
            }
        } catch {
            return null;
        }
        return parts;
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

    private getCachedRequirement(
        parts: ControlCurieResult
    ): Promise<unknown | null> {
        if (!parts.version) return Promise.resolve(null);
        return this.shaCache.get(
            `${this.hubBaseHash}-domain-controls`,
            parts.domain,
            parts.controlName,
            parts.version
        );
    }

    private putCachedRequirement(
        parts: ControlCurieResult,
        schema: unknown
    ): Promise<void> {
        if (!parts.version) return Promise.resolve();
        return this.shaCache.put(
            `${this.hubBaseHash}-domain-controls`,
            parts.domain,
            parts.controlName,
            parts.version,
            schema
        );
    }

    /**
     * Persist a standalone control requirement to `controls/` in the workspace
     * folder holding the current document, then rescan (standards may now
     * resolve previously-missing control-refs) and refresh the webview.
     */
    private async handleSaveControl(
        requestId: string,
        filename: string,
        content: string
    ): Promise<void> {
        try {
            await this.scanReadyPromise;

            // Slug stem with either `.requirement.json` (convention) or plain `.json`.
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

            // Extract domain from CURIE $id (e.g. "platform:controls:slug" → "platform")
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

            // Full rescan: standards with previously-missing control-refs may now resolve.
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

    /**
     * Check for available updates by comparing pinned SHAs in the current document
     * against the latest versions from the Hub. Sends an `updatesAvailable` message
     * to the webview with a list of nodes that have newer versions.
     */
    private async checkForUpdates(): Promise<void> {
        if (!this.hubClient || !this.currentDocument) return;

        try {
            const text = this.currentDocument.getText();
            if (!text.trim()) return;
            const arch = JSON.parse(text) as {
                nodes?: Array<{
                    'unique-id'?: string;
                    'definition-id'?: string;
                }>;
            };
            if (!arch?.nodes) return;

            const updates: Array<{
                nodeId: string;
                currentSha: string;
                latestSha: string;
            }> = [];

            for (const node of arch.nodes) {
                const defId = node['definition-id'];
                if (!defId) continue;
                const { namespace, type, slug, version } = parseCurie(defId);
                if (!version) continue;

                try {
                    const versions = await this.hubClient.getVersions(
                        namespace,
                        type,
                        slug
                    );
                    if (versions.length === 0) continue;
                    const latestSha = versions[versions.length - 1];
                    if (latestSha !== version) {
                        updates.push({
                            nodeId: node['unique-id'] ?? '',
                            currentSha: version,
                            latestSha,
                        });
                    }
                } catch {
                    /* skip nodes that fail version lookup */
                }
            }

            if (updates.length > 0) {
                this.postMessage({ type: 'updatesAvailable', updates });
                this.log.appendLine(
                    `[CanvasPanel] ${updates.length} update(s) available`
                );
            }
        } catch {
            /* non-JSON document or other parse error */
        }
    }

    private async handleOpenControlInHub(ref: string): Promise<void> {
        if (!this.hubClient) {
            vscode.window.showWarningMessage('Hub not connected');
            return;
        }
        const parts = parseControlCurie(ref);
        if (!parts) return;
        try {
            const resolved = await this.hubClient.resolveControlId(
                parts.domain,
                parts.controlName
            );
            const baseUrl = this.hubClient.getBaseUrl();
            const hubUrl = `${baseUrl}/#/${encodeURIComponent(resolved.domain)}/controls/${resolved.id}/detail`;
            await vscode.env.openExternal(vscode.Uri.parse(hubUrl));
        } catch (err) {
            this.log.appendLine(
                `[CanvasPanel] Failed to open control in Hub: ${err instanceof Error ? err.message : String(err)}`
            );
            vscode.window.showWarningMessage(`Could not open control in Hub: ${describeError(err)}`);
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
