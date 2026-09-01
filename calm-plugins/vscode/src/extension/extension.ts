import * as vscode from 'vscode';
import { CanvasPanel } from './webview/canvas-panel';
import { CalmCanvasCodeLensProvider } from './services/codelens-provider';
import { HubClient } from './services/hub-client';
import { HubAuthService } from './services/hub-auth-service';
import { HubStatusBar } from './services/hub-status-bar';

let canvasPanel: CanvasPanel | undefined;
let outputChannel: vscode.OutputChannel;
let hubStatusBar: HubStatusBar | undefined;
let hubClient: HubClient | undefined;
let hubAuthService: HubAuthService | undefined;

const CALM_FILE_SUFFIXES = [
    '.calm.json',
    '.architecture.json',
    '.template.json',
    '.solution.json',
    '.standard.json',
    '.guideline.json',
];

function isCalmFile(fsPath: string): boolean {
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
            }
            canvasPanel.reveal(document);
        }
    );

    context.subscriptions.push(openCanvas);

    // Inline "View in CALM Canvas" affordances on CALM documents.
    const calmSelector: vscode.DocumentSelector = [
        { pattern: '**/*.calm.json' },
        { pattern: '**/*.architecture.json' },
        { pattern: '**/*.template.json' },
        { pattern: '**/*.solution.json' },
        { pattern: '**/*.standard.json' },
        { pattern: '**/*.guideline.json' },
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

async function connectToHub(
    context: vscode.ExtensionContext
): Promise<void> {
    let url = vscode.workspace
        .getConfiguration('calm.hub')
        .get<string>('url');

    if (url && (hubStatusBar?.state === 'connected' || hubStatusBar?.state === 'error')) {
        const items = hubStatusBar?.state === 'connected'
            ? [
                { label: '$(list-selection) Select Namespaces', action: 'namespaces' },
                { label: '$(sync) Refresh from Hub', action: 'refresh' },
                { label: '$(pencil) Change Hub URL', action: 'change' },
                { label: '$(sign-out) Disconnect', action: 'disconnect' },
            ]
            : [
                { label: '$(pencil) Change Hub URL', action: 'change' },
                { label: '$(debug-restart) Retry Connection', action: 'retry' },
                { label: '$(sign-out) Clear URL', action: 'disconnect' },
            ];

        const choice = await vscode.window.showQuickPick(items, {
            placeHolder: hubStatusBar?.state === 'connected'
                ? `Connected to ${url}`
                : `Failed to connect to ${url}`,
        });
        if (!choice) return;
        if (choice.action === 'disconnect') { await disconnectFromHub(); return; }
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
        hubClient = new HubClient(url);
        hubAuthService = new HubAuthService(context.secrets, hubClient);
        await hubAuthService.initialize();

        const authenticated =
            await hubAuthService.discoverAndAuthenticate();
        if (!authenticated) {
            hubStatusBar!.setState('error');
            return;
        }

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

        // Refresh the canvas palette if open
        if (canvasPanel) {
            canvasPanel.refreshAssets();
        }

        outputChannel.appendLine(
            `[INFO] Connected to ${url} — ${availableNames.length} available, ${validSelection.length} selected`
        );
    } catch (err) {
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

async function disconnectFromHub(): Promise<void> {
    if (hubAuthService) {
        await hubAuthService.signOut();
    }
    hubClient = undefined;
    hubAuthService = undefined;
    hubStatusBar?.setState('disconnected');
    outputChannel.appendLine('[INFO] Disconnected from CalmHub');
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
        hubStatusBar.setState('connected', namespaces.length);
        outputChannel.appendLine(
            `[INFO] Refreshed from CalmHub — ${namespaces.length} namespace(s)`
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
