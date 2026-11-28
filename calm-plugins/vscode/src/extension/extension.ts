import * as vscode from 'vscode';
import * as path from 'path';
import { CanvasPanel } from './webview/canvas-panel';
import { CalmCanvasCodeLensProvider } from './services/codelens-provider';
import { HubClient } from './services/hub-client';
import { HubAuthService } from './services/hub-auth-service';
import { HubStatusBar } from './services/hub-status-bar';
import { SvgImportService } from './services/svg-import';
import { ExportService, ExportCancelledError } from './services/export-service';
import { ImportService, ImportCancelledError } from './services/import-service';

let canvasPanel: CanvasPanel | undefined;
let outputChannel: vscode.OutputChannel;
let hubStatusBar: HubStatusBar | undefined;
let hubClient: HubClient | undefined;
let hubAuthService: HubAuthService | undefined;

export const CALM_FILE_SUFFIXES = [
    '.calm.json',
    '.architecture.json',
];

export function isCalmFile(fsPath: string): boolean {
    return CALM_FILE_SUFFIXES.some((suffix) => fsPath.endsWith(suffix));
}

export function activate(context: vscode.ExtensionContext): void {
    outputChannel = vscode.window.createOutputChannel('CALM Canvas');
    outputChannel.appendLine('[INFO] CALM Canvas extension activated');

    const roots = vscode.workspace.workspaceFolders ?? [];
    outputChannel.appendLine(
        `[INFO] Workspace folders: ${roots.map((f) => f.uri.fsPath).join(', ') || 'NONE'}`
    );

    const externalPath = vscode.workspace
        .getConfiguration('calm')
        .get<string>('externalAssetsPath');
    if (externalPath) {
        outputChannel.appendLine(
            `[INFO] External assets path: ${externalPath}`
        );
    }

    const openCanvas = vscode.commands.registerCommand(
        'calm.openCanvas',
        async (uri?: vscode.Uri) => {
            let document: vscode.TextDocument | undefined;

            if (uri && isCalmFile(uri.fsPath)) {
                document = await vscode.workspace.openTextDocument(uri);
            } else {
                const editor = vscode.window.activeTextEditor;
                if (editor && isCalmFile(editor.document.uri.fsPath)) {
                    document = editor.document;
                }
            }

            if (!document) {
                vscode.window.showWarningMessage(
                    'Open a .calm.json file first.'
                );
                return;
            }

            if (!canvasPanel) {
                canvasPanel = new CanvasPanel(context, outputChannel);
                canvasPanel.onDispose(() => {
                    canvasPanel = undefined;
                });
                // If the Hub is already connected, wire the panel immediately.
                if (hubClient) {
                    void canvasPanel.setHubConnection(hubClient);
                }
            }
            canvasPanel.reveal(document);
        }
    );

    context.subscriptions.push(openCanvas);

    const svgImportService = new SvgImportService(outputChannel);
    const importSvg = vscode.commands.registerCommand(
        'calm.importSvg',
        async (uri?: vscode.Uri) => {
            await svgImportService.importSvgToNewFile(uri);
        }
    );
    context.subscriptions.push(importSvg);

    // --- Export/Import Bundle commands ---
    const exportService = new ExportService(outputChannel);
    const importService = new ImportService(outputChannel);

    const exportBundle = vscode.commands.registerCommand(
        'calm.exportBundle',
        async (uri?: vscode.Uri) => {
            try {
                const document = uri
                    ? await vscode.workspace.openTextDocument(uri)
                    : vscode.window.activeTextEditor?.document;

                if (!document) {
                    void vscode.window.showErrorMessage('No architecture file is currently open');
                    return;
                }
                if (document.isDirty && !await document.save()) {
                    throw new Error('Save the document before exporting the bundle');
                }

                const filePath = document.uri.fsPath;
                const fileName = path.basename(filePath);
                const currentDirectory = path.dirname(filePath);

                const result = await exportService.exportBundle({
                    architecturePath: fileName === 'index.md' ? undefined : filePath,
                    currentDirectory,
                });

                let message = `Exported ${result.fileCount} files to ${path.basename(result.archivePath)}`;
                if (result.warnings.length > 0) {
                    message += ` (${result.warnings.length} warnings)`;
                }

                const selection = await vscode.window.showInformationMessage(
                    message,
                    'Open Folder',
                    'OK'
                );

                if (selection === 'Open Folder') {
                    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.archivePath));
                }

                outputChannel.appendLine(`[Export] Success: ${result.archivePath}`);
            } catch (err) {
                if (err instanceof ExportCancelledError) {
                    outputChannel.appendLine('[Export] Cancelled by user');
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                outputChannel.appendLine(`[Export] ERROR: ${message}`);

                void vscode.window.showErrorMessage(`Export failed: ${message}`);
            }
        }
    );
    context.subscriptions.push(exportBundle);

    const importBundle = vscode.commands.registerCommand(
        'calm.importBundle',
        async (uri?: vscode.Uri) => {
            try {
                const zipPath = uri?.fsPath;
                const result = await importService.importBundle({
                    zipPath,
                });

                const selection = await vscode.window.showInformationMessage(
                    `Imported ${result.fileCount} files to ${path.basename(result.extractedPath)}`,
                    'Open Folder',
                    'OK'
                );

                if (selection === 'Open Folder') {
                    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.extractedPath));
                }

                outputChannel.appendLine(`[Import] Success: ${result.extractedPath}`);
            } catch (err) {
                if (err instanceof ImportCancelledError) {
                    outputChannel.appendLine('[Import] Cancelled by user');
                    return;
                }

                const message = err instanceof Error ? err.message : String(err);
                outputChannel.appendLine(`[Import] ERROR: ${message}`);

                void vscode.window.showErrorMessage(`Import failed: ${message}`);
            }
        }
    );
    context.subscriptions.push(importBundle);

    // Inline "View in CALM Canvas" affordances on CALM documents.
    const calmSelector: vscode.DocumentSelector = [
        { pattern: '**/*.calm.json' },
        { pattern: '**/*.architecture.json' },
    ];
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            calmSelector,
            new CalmCanvasCodeLensProvider()
        )
    );

    // --- CalmHub integration ---
    hubStatusBar = new HubStatusBar();
    context.subscriptions.push(hubStatusBar);

    const connectToHubCmd = vscode.commands.registerCommand(
        'calm.connectToHub',
        () => connectToHub(context)
    );
    const disconnectFromHubCmd = vscode.commands.registerCommand(
        'calm.disconnectFromHub',
        () => disconnectFromHub()
    );
    const refreshFromHubCmd = vscode.commands.registerCommand(
        'calm.refreshFromHub',
        () => refreshFromHub()
    );
    context.subscriptions.push(
        connectToHubCmd,
        disconnectFromHubCmd,
        refreshFromHubCmd
    );

    // Auto-connect if URL is configured and autoConnect is enabled
    const hubUrl = vscode.workspace
        .getConfiguration('calm.hub')
        .get<string>('url');
    const autoConnect = vscode.workspace
        .getConfiguration('calm.hub')
        .get<boolean>('autoConnect', true);
    if (hubUrl && autoConnect) {
        connectToHub(context);
    }
}

export type HubMenuAction =
    | 'namespaces'
    | 'refresh'
    | 'change'
    | 'disconnect'
    | 'retry'
    | 'clearUrl';

export interface HubMenuItem {
    label: string;
    action: HubMenuAction;
}

/**
 * Items of the CALM Hub status bar menu. A plain disconnect keeps the saved URL,
 * so "Disconnect" stays in the connected state and the tooltip's "Click to
 * reconnect" works; only the failed state offers "Clear URL" (#3494).
 */
export function hubMenuItems(state: 'connected' | 'error'): HubMenuItem[] {
    if (state === 'connected') {
        return [
            { label: '$(list-selection) Select Namespaces', action: 'namespaces' },
            { label: '$(sync) Refresh from Hub', action: 'refresh' },
            { label: '$(pencil) Change Hub URL', action: 'change' },
            { label: '$(sign-out) Disconnect', action: 'disconnect' },
        ];
    }
    return [
        { label: '$(pencil) Change Hub URL', action: 'change' },
        { label: '$(debug-restart) Retry Connection', action: 'retry' },
        { label: '$(sign-out) Clear URL', action: 'clearUrl' },
    ];
}

async function connectToHub(
    context: vscode.ExtensionContext
): Promise<void> {
    let url = vscode.workspace
        .getConfiguration('calm.hub')
        .get<string>('url');

    if (url && (hubStatusBar?.state === 'connected' || hubStatusBar?.state === 'error')) {
        const items = hubMenuItems(
            hubStatusBar?.state === 'connected' ? 'connected' : 'error'
        );

        const choice = await vscode.window.showQuickPick(items, {
            placeHolder: hubStatusBar?.state === 'connected'
                ? `Connected to ${url}`
                : `Failed to connect to ${url}`,
        });
        if (!choice) return;
        if (choice.action === 'disconnect') { await disconnectFromHub(); return; }
        if (choice.action === 'clearUrl') {
            await disconnectFromHub({ clearUrl: true });
            return;
        }
        if (choice.action === 'namespaces') { await selectNamespaces(); return; }
        if (choice.action === 'refresh' || choice.action === 'retry') {
            // Fall through to reconnect with existing URL
        } else {
            // 'change' — clear URL so the input box shows
            url = undefined;
        }
    }

    if (!url) {
        const currentUrl = vscode.workspace.getConfiguration('calm.hub').get<string>('url') ?? '';
        const input = await vscode.window.showInputBox({
            prompt: 'CalmHub URL',
            placeHolder: 'https://calmhub.example.com',
            value: currentUrl,
        });
        if (!input) return;
        await vscode.workspace
            .getConfiguration('calm.hub')
            .update('url', input, vscode.ConfigurationTarget.Global);
        url = input;
    }

    hubStatusBar!.setState('connecting', undefined, url);

    try {
        const client = new HubClient(url);
        const authService = new HubAuthService(context.secrets, client, url);
        await authService.initialize();

        const authenticated =
            await authService.discoverAndAuthenticate();
        if (!authenticated) {
            hubStatusBar!.setState('error');
            return;
        }

        // Assign to module-level only after successful auth
        hubClient = client;
        hubAuthService = authService;

        const namespaces = await hubClient.getNamespaces();
        const availableNames = namespaces.map((ns: { name: string }) => ns.name);

        // Validate saved selection against available namespaces (remove revoked access)
        const savedSelection: string[] = vscode.workspace
            .getConfiguration('calm.hub')
            .get<string[]>('selectedNamespaces') ?? [];
        const validSelection = savedSelection.filter((ns) => availableNames.includes(ns));
        if (validSelection.length !== savedSelection.length) {
            await vscode.workspace
                .getConfiguration('calm.hub')
                .update('selectedNamespaces', validSelection, vscode.ConfigurationTarget.Global);
            outputChannel.appendLine(
                `[INFO] Cleaned namespace selection: removed ${savedSelection.length - validSelection.length} inaccessible namespace(s)`
            );
        }

        hubStatusBar!.setState('connected', availableNames.length, url);
        hubStatusBar!.setAvailableAndSelected(availableNames, validSelection);

        // Hand the authenticated client to the canvas panel — this refreshes
        // Hub assets and posts them to the webview.
        if (canvasPanel) {
            void canvasPanel.setHubConnection(hubClient);
        }

        outputChannel.appendLine(
            `[INFO] Connected to ${url} — ${availableNames.length} available, ${validSelection.length} selected`
        );
    } catch (err) {
        hubClient = undefined;
        hubAuthService = undefined;
        hubStatusBar!.setState('error');
        const message =
            err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(
            `[ERROR] Failed to connect to CalmHub: ${message}`
        );
        vscode.window.showErrorMessage(
            `Failed to connect to CalmHub: ${message}`
        );
    }
}

export interface DisconnectOptions {
    /**
     * Also forget the saved `calm.hub.url`. Only the error menu's "Clear URL"
     * asks for this; a plain disconnect keeps the URL so the status bar's
     * "Click to reconnect" works (#3494).
     */
    clearUrl?: boolean;
}

export async function disconnectFromHub(
    options: DisconnectOptions = {}
): Promise<void> {
    if (hubAuthService) {
        await hubAuthService.signOut();
    }
    hubClient = undefined;
    hubAuthService = undefined;
    hubStatusBar?.setState('disconnected');
    void canvasPanel?.setHubConnection(undefined);
    if (options.clearUrl) {
        await vscode.workspace
            .getConfiguration('calm.hub')
            .update('url', undefined, vscode.ConfigurationTarget.Global);
        hubStatusBar?.clearHubUrl();
    }
    outputChannel.appendLine(
        options.clearUrl
            ? '[INFO] Disconnected from CalmHub and cleared the saved URL'
            : '[INFO] Disconnected from CalmHub'
    );
}

async function refreshFromHub(): Promise<void> {
    if (!hubClient || !hubStatusBar || hubStatusBar.state !== 'connected') {
        vscode.window.showWarningMessage(
            'Not connected to CalmHub. Use "CALM: Connect to Hub" first.'
        );
        return;
    }

    try {
        hubStatusBar.setState('connecting');
        const namespaces = await hubClient.getNamespaces();
        const availableNames = namespaces.map(ns => ns.name);
        const savedSelection = vscode.workspace.getConfiguration('calm.hub')
            .get<string[]>('selectedNamespaces') ?? [];
        const validSelection = savedSelection.filter(ns => availableNames.includes(ns));
        hubStatusBar.setState('connected', availableNames.length);
        hubStatusBar.setAvailableAndSelected(availableNames, validSelection);
        void canvasPanel?.setHubConnection(hubClient, true);
        outputChannel.appendLine(
            `[INFO] Refreshed from CalmHub (clean) — ${availableNames.length} namespace(s)`
        );
    } catch (err) {
        hubStatusBar.setState('error');
        const message =
            err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(
            `[ERROR] Refresh from CalmHub failed: ${message}`
        );
    }
}

async function selectNamespaces(): Promise<void> {
    if (!hubClient || !hubStatusBar) return;

    try {
        const allNamespaces = await hubClient.getNamespaces();
        const currentlySelected: string[] = vscode.workspace
            .getConfiguration('calm.hub')
            .get<string[]>('selectedNamespaces') ?? [];

        const items = allNamespaces.map((ns: { name: string }) => ({
            label: ns.name,
            picked: currentlySelected.includes(ns.name),
        }));

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select namespaces to show in the palette',
        });

        if (!selected) return;

        const selectedNames = selected.map((s) => s.label);
        await vscode.workspace
            .getConfiguration('calm.hub')
            .update('selectedNamespaces', selectedNames, vscode.ConfigurationTarget.Global);

        const allNsNames = allNamespaces.map((ns: { name: string }) => ns.name);
        hubStatusBar.setAvailableAndSelected(allNsNames, selectedNames);
        outputChannel.appendLine(
            `[INFO] Selected namespaces: ${selectedNames.join(', ')}`
        );

        // Refresh palette with new namespace filter
        if (canvasPanel) {
            canvasPanel.refreshAssets();
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`[ERROR] Failed to list namespaces: ${message}`);
    }
}

export function deactivate(): void {
    canvasPanel?.dispose();
}
