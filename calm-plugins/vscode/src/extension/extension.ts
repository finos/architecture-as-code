import * as vscode from 'vscode';
import { CanvasPanel } from './webview/canvas-panel';
import { CalmCanvasCodeLensProvider } from './services/codelens-provider';

let canvasPanel: CanvasPanel | undefined;
let outputChannel: vscode.OutputChannel;

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
}

export function deactivate(): void {
    canvasPanel?.dispose();
}
