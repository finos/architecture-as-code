import * as vscode from 'vscode';
import { visualize } from './visualize.js';

export function activate(context: vscode.ExtensionContext) {
    let panel: vscode.WebviewPanel | undefined = undefined;
    let svg: string | undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('calm.visualize.instantiation', async () => {
            const editor = vscode.window.activeTextEditor;
            const columnToShowIn = editor ? editor.viewColumn : undefined;

            if (panel) {
                panel.reveal(columnToShowIn);
            } else {
                panel = vscode.window.createWebviewPanel(
                    'calmVisualize',
                    'Calm Visualize Current Instantiation File',
                    columnToShowIn || vscode.ViewColumn.One,
                    {}
                );

                try {
                    const data = editor?.document.getText();
                    if(data){
                        svg = await visualize(data);
                        panel.webview.html = getWebviewContent(svg);
                    }
                } catch (error:unknown) {
                    vscode.window.showErrorMessage('Error visualizing instantiation: ' + error);
                }

                // On update
                vscode.workspace.onDidSaveTextDocument(async (document) => {
                    if (editor && panel) {
                        vscode.window.showInformationMessage(`Document ${document.fileName} updated`);
                        try {
                            const data = editor?.document.getText();
                            if(data){
                                svg = await visualize(data);
                                panel.webview.html = getWebviewContent(svg);
                                panel.reveal(columnToShowIn);
                            }
                        } catch (error: unknown) {
                            vscode.window.showErrorMessage('Error updating visualization: ' + error);
                        }
                    }
                });

                panel.onDidDispose(
                    () => {
                        panel = undefined;
                    },
                    null,
                    context.subscriptions
                );
            }
        })
    );
}


function getWebviewContent(svg: string | undefined) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Calm Instantiation SVG</title>
    </head>
    <body>
       ${svg}
    </body>
    </html>`;
}

export function deactivate() {}