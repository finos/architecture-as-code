import * as vscode from 'vscode';
import { languages, Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { validate, ValidationOutput, visualize } from '@finos/calm-shared';
import { JSONPath } from 'jsonpath-plus';
import * as jsonSourceMap from 'json-source-map';
import { ValidationOutcome } from '@finos/calm-shared/dist/commands/validate/validation.output';

export function activate(context: vscode.ExtensionContext) {

    let panel: vscode.WebviewPanel | undefined = undefined;

    const visualizeCommand = vscode.commands.registerCommand('calm-validate.visualize', async () => {
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

            //Initial visualization - then will hook into same function for rendering updates.
            visualizeDocument(editor, panel, columnToShowIn);

            // On update
            vscode.workspace.onDidSaveTextDocument(async (document) => {
                if (editor && panel) {
                    vscode.window.showInformationMessage(`Document ${document.fileName} updated`);
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

    const validateCommand = vscode.commands.registerCommand('calm-validate.validate', () => {
        const diagnosticCollection = languages.createDiagnosticCollection('calm');
        vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            if (document.uri.fsPath.endsWith('.json')) {
                vscode.commands.executeCommand('editor.action.formatDocument');
                const editor = vscode.window.activeTextEditor;
                try {
                    const data = editor?.document.getText();
                    if (data && vscode.window.activeTextEditor) {
                        diagnosticCollection.clear();
                        const calmResult: ValidationOutcome = await callCalmValidate(data);
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
    vscode.commands.executeCommand('calm-validate.validate');
}



async function visualizeDocument(editor, panel, columnToShowIn) {
    try {
        const data = editor?.document.getText();
        if(data){
            const issueCount = await validationIssueCount(data);
            if(issueCount > 0) {
                vscode.window.showInformationMessage(`Please resolve the ${issueCount} validation issues before visualizing.`);
                panel.dispose();
                panel = undefined;
            } else {
                const svg = await visualize(data);
                panel.webview.html = getWebviewContent(svg);
                panel.reveal(columnToShowIn);
            }
        }
    } catch (error:unknown) {
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
async function callCalmValidate(pageData: string): Promise<ValidationOutcome> {
    // TODO - if we pass in an implementation - the pattern should resolved from $schema 
    // TODO - remove these hard-codings
    const api_gateway = 'C:\\Users\\ross_\\code\\architecture-as-code\\shared\\test_fixtures\\api-gateway.json';
    const api_gateway_impl = 'C:\\Users\\ross_\\code\\architecture-as-code\\shared\\test_fixtures\\api-gateway-implementation.json';
    const schema_location = 'C:\\Users\\ross_\\code\\architecture-as-code\\shared\\test_fixtures\\calm';
    return await validate(api_gateway_impl, api_gateway, schema_location, false);
}

async function validationIssueCount(pageData: string): Promise<number> {
    const validationOutcome = await callCalmValidate(pageData);
    return validationOutcome.allValidationOutputs().length;
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
