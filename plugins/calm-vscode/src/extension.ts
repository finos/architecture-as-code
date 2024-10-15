import * as vscode from 'vscode';
import { languages, Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { validate, ValidationOutput, visualize } from '@finos/calm-shared';
import { JSONPath } from 'jsonpath-plus';
import * as jsonSourceMap from 'json-source-map';
import { ValidationOutcome } from '@finos/calm-shared/dist/commands/validate/validation.output';

const CALM_DRAFT_VERSION = '2024-10';

export function activate(context: vscode.ExtensionContext) {

    let panel: vscode.WebviewPanel | undefined = undefined;

    const visualizeCommand = vscode.commands.registerCommand('calm-vscode.visualize', async () => {
        const editor = vscode.window.activeTextEditor;
        const columnToShowIn = editor ? editor.viewColumn : undefined;

        if (panel) {
            panel.reveal(columnToShowIn);
        } else {
            panel = vscode.window.createWebviewPanel(
                'calm-vscode.visualize',
                'CALM - Visualization',
                columnToShowIn || vscode.ViewColumn.One,
                {}
            );

            //Initial visualization - then will hook into same function for rendering updates.
            visualizeDocument(editor, panel, columnToShowIn);

            // On update
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                if (editor && panel) {
                    visualizeDocument(editor, panel, columnToShowIn);
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
    });

    const validateCommand = vscode.commands.registerCommand('calm-vscode.validate', () => {
        const diagnosticCollection = languages.createDiagnosticCollection('calm');
        vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            if (document.uri.fsPath.endsWith('.json')) {
                vscode.commands.executeCommand('editor.action.formatDocument');
                const editor = vscode.window.activeTextEditor;
                try {
                    const data: string = editor?.document.getText();
                    const absPath: string = editor?.document?.uri?.fsPath;
                    if (data && vscode.window.activeTextEditor) {
                        diagnosticCollection.clear();
                        const calmResult: ValidationOutcome = await callCalmValidate(data, absPath);
                        const diagnostics: Diagnostic[] = calmResult.allValidationOutputs().map((calmValidation: ValidationOutput) => mapTo(data, calmValidation));
                        diagnosticCollection.set(vscode.window.activeTextEditor.document.uri, diagnostics);
                    }
                } catch (error: unknown) {
                    vscode.window.showErrorMessage('Error validating current file: ' + error);
                }
            }
        });
    });

    context.subscriptions.push(validateCommand, visualizeCommand);
    vscode.commands.executeCommand('calm-vscode.validate');
}



async function visualizeDocument(editor: vscode.TextEditor, panel: vscode.WebviewPanel, columnToShowIn: vscode.ViewColumn) {
    try {
        const data = editor?.document.getText();
        const absPath = editor?.document?.uri?.fsPath;
        if (data) {
            const issueCount = await validationIssueCount(data, absPath);
            if (issueCount > 0) {
                vscode.window.showInformationMessage(`Please resolve the ${issueCount} validation issues before visualizing.`);
                panel.dispose();
                panel = undefined;
            } else {
                const svg = await visualize(data);
                panel.webview.html = getWebviewContent(svg);
                panel.reveal(columnToShowIn);
            }
        }
    } catch (error: unknown) {
        vscode.window.showErrorMessage('Error visualizing current file: ' + error);
    }
}

function mapTo(jsonDataFromFile: string, calmValidation: ValidationOutput): vscode.Diagnostic {

    let { line_start, line_end, character_start, character_end } = calmValidation;
    if (calmValidation.line_start === undefined || (calmValidation.line_start === 1)) {
        const data = getLineNumbers(jsonDataFromFile, calmValidation.path);
        if (data.length === 1) {
            line_start = data[0].line_start;
            line_end = data[0].line_end;
            character_start = data[0].character_start;
            character_end = data[0].character_end;
        }
    }

    return new Diagnostic(new Range(new vscode.Position(line_start, character_start), new vscode.Position(line_end, character_end)), calmValidation.message, convertSeverity(calmValidation.severity));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function callCalmValidate(pageData: string, absFilePath: string): Promise<ValidationOutcome> {

    const schema = singleValueFrom(pageData, '$.$schema');
    const id = singleValueFrom(pageData, '$.$id');

    let instantiation = undefined;
    let pattern = undefined;

    if (schema?.includes('/pattern/') && id === undefined) {
        instantiation = absFilePath;
        pattern = schema;

    } else if (id?.includes('/pattern/')) {
        pattern = absFilePath;
    }

    const schema_location = `https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/${CALM_DRAFT_VERSION}/meta/calm.json`;
    return await validate(instantiation, pattern, schema_location, false);
}

async function validationIssueCount(pageData: string, absFilePath: string): Promise<number> {
    const validationOutcome = await callCalmValidate(pageData, absFilePath);
    return validationOutcome.allValidationOutputs().length;
}

function singleValueFrom(pageData: string, jsonPath: string): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: jsonObj, pointers } = jsonSourceMap.parse(pageData);
    const results = JSONPath({ path: jsonPath, json: jsonObj });
    if (results.length == 1) {
        return results[0];
    }
    return undefined;
}

function convertSeverity(severityStr: string): DiagnosticSeverity {
    if (severityStr === 'error') {
        return DiagnosticSeverity.Error;
    } else if (severityStr === 'warning') {
        return DiagnosticSeverity.Warning;
    } else {
        return DiagnosticSeverity.Information;
    }
}

function getLineNumbers(jsonStr: string, jsonPathExpr: string) {

    const { data: jsonObj, pointers } = jsonSourceMap.parse(jsonStr);
    const results = JSONPath({ path: generatePath(jsonPathExpr.split('/')), json: jsonObj });

    if (!results.length) {
        return null;
    }

    const lineNumbers = results.map(() => {
        const position = pointers[jsonPathExpr];
        if (position) {
            const line_start = position.value.line;
            const line_end = position.valueEnd.line;
            const character_start = position.value.column;
            const character_end = position.valueEnd.column;
            return { line_start: line_start, line_end: line_end, character_start: character_start, character_end: character_end };
        }
    });

    return lineNumbers;
}

function generatePath(arr) {
    let result = '$';

    arr.forEach(item => {
        if (!isNaN(item) && item !== '') {
            result += `[${item}]`;
        } else {
            result += `.${item}`;
        }
    });

    return result;
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

export function deactivate() { }
