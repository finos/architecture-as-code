import * as vscode from 'vscode';
import { getWebviewHtml } from './html-provider';
import { SyncCoordinator } from '../services/sync-coordinator';
import { WorkspaceAssetService } from '../services/workspace-asset-service';
import { DiagramExportService } from '../services/diagram-export-service';
import { HubClient } from '../services/hub-client';
import { HubAssetService } from '../services/hub-asset-service';
import { ShaCacheService } from '../services/sha-cache-service';
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
 */
function pinControlCuries(
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
            // Already versioned or not a CURIE (no colons)
            if (url.includes('@') || (url.match(/:/g) ?? []).length < 2) return req;
            return { ...req, 'requirement-url': `${url}@${sha}` };
        });
        pinned[key] = { ...c, requirements: pinnedReqs };
    }
    return pinned;
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
    private shaCache = new ShaCacheService();
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
        const workspaceRoot =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        this.log.appendLine(
            `[CanvasPanel] constructor, workspaceRoot: ${workspaceRoot}`
        );
        this.assetService = new WorkspaceAssetService(workspaceRoot);
        const hubUrl = vscode.workspace
            .getConfiguration('calm.hub')
            .get<string>('url');
        if (hubUrl?.trim()) {
            this.hubClient = new HubClient(hubUrl.trim());
            this.hubAssetService = new HubAssetService(this.hubClient);
            // Load stored auth token THEN refresh Hub assets
            void this.context.secrets.get('calm.hub.token').then((token) => {
                if (token) {
                    this.hubClient!.setAuthHeaders({ Authorization: `Bearer ${token}` });
                }
                return this.hubAssetService!.refresh();
            }).then(() => {
                this.log.appendLine(
                    `[CanvasPanel] Hub asset refresh complete: ${this.hubAssetService!.getNamespaces().reduce((n, ns) => n + ns.buildingBlocks.length, 0)} blocks, ${this.hubAssetService!.getNamespaces().reduce((n, ns) => n + ns.standards.length, 0)} standards`
                );
                if (this.scanReady && this.webviewReady) {
                    this.sendAssets();
                }
            }).catch((err) => {
                this.log.appendLine(
                    `[CanvasPanel] Hub asset refresh failed: ${String(err)}`
                );
            });
        }
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
            case 'resolveDefinitionId':
                void this.handleResolveDefinitionId(
                    message.nodeId,
                    message.curie
                );
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
        const p = this.assetService.getPatterns();
        const t = this.assetService.getTemplates();
        const s = this.assetService.getStandards();

        // Merge Hub-sourced blocks and standards — only show explicitly selected namespaces
        const selectedNs: string[] = vscode.workspace
            .getConfiguration('calm.hub')
            .get<string[]>('selectedNamespaces') ?? [];
        const hubBlocks = this.hubAssetService?.getAllBuildingBlocks(selectedNs) ?? [];
        const hubStandards = this.hubAssetService?.getAllStandards(selectedNs) ?? [];
        const allBlocks = [...localBlocks, ...hubBlocks, ...hubStandards];

        this.log.appendLine(
            `[CanvasPanel] Sending assets to webview: ${allBlocks.length} nodes (${localBlocks.length} local + ${hubBlocks.length} hub blocks + ${hubStandards.length} hub standards), ${p.length} patterns, ${t.length} templates, ${s.length} standards`
        );
        this.postMessage({ type: 'buildingBlocksLoaded', nodes: allBlocks });
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
                    const pinned = pinControlCuries(rawControls, version);
                    const controls = await this.enrichControlValidation(pinned);
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
                const pinned = pinControlCuries(rawControls, version);
                const controls = await this.enrichControlValidation(pinned);
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

    /**
     * Resolve each control's requirement-url CURIE to fetch its JSON Schema
     * and extract validation metadata (allowed-values, pattern).
     */
    private async enrichControlValidation(
        controls: Record<string, unknown>
    ): Promise<Record<string, unknown>> {
        if (!this.hubClient) return controls;

        const enriched: Record<string, unknown> = {};
        const fetchPromises: Array<Promise<void>> = [];

        for (const [key, ctrl] of Object.entries(controls)) {
            if (!ctrl || typeof ctrl !== 'object') {
                enriched[key] = ctrl;
                continue;
            }
            const c = ctrl as Record<string, unknown>;
            const reqs = c.requirements as Array<Record<string, unknown>> | undefined;
            const url = reqs?.[0]?.['requirement-url'];
            if (typeof url !== 'string' || !url.includes('@')) {
                enriched[key] = ctrl;
                continue;
            }

            const { namespace: ctrlNs, type: ctrlType, slug: ctrlSlug, version: ctrlVersion } = parseCurie(url);
            if (!ctrlVersion) {
                enriched[key] = ctrl;
                continue;
            }

            const client = this.hubClient;
            fetchPromises.push(
                (async () => {
                    try {
                        const schema = await client.getResourceAtVersion(
                            ctrlNs, ctrlType, ctrlSlug, ctrlVersion
                        ) as Record<string, unknown>;

                        const props = schema?.properties as Record<string, unknown> | undefined;
                        const valueProp = props?.value as Record<string, unknown> | undefined;
                        if (!valueProp) {
                            enriched[key] = ctrl;
                            return;
                        }

                        const validation: Record<string, unknown> = {};
                        if (Array.isArray(valueProp.enum)) {
                            validation['allowed-values'] = valueProp.enum;
                        }
                        if (typeof valueProp.pattern === 'string') {
                            validation.pattern = valueProp.pattern;
                        }
                        if (typeof valueProp.description === 'string') {
                            validation.example = valueProp.description;
                        }

                        if (Object.keys(validation).length > 0) {
                            enriched[key] = {
                                ...c,
                                metadata: { ...(c.metadata as Record<string, unknown> ?? {}), validation },
                            };
                        } else {
                            enriched[key] = ctrl;
                        }
                    } catch {
                        enriched[key] = ctrl;
                    }
                })()
            );
        }

        await Promise.all(fetchPromises);
        // Fill any controls not handled by async fetches
        for (const [key, ctrl] of Object.entries(controls)) {
            if (!(key in enriched)) enriched[key] = ctrl;
        }
        return enriched;
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
