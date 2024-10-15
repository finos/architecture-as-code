import * as vscode from 'vscode';
import { languages, Diagnostic, DiagnosticSeverity, Range } from 'vscode';
import { validate, ValidationOutput } from '@finos/calm-shared';
import { JSONPath } from 'jsonpath-plus';
import * as jsonSourceMap from 'json-source-map';
import { ValidationOutcome } from '@finos/calm-shared/dist/commands/validate/validation.output';

//TODO is there a better way to refer to this?
const CALM_DRAFT_VERSION = '2024-10';

export function activate(context: vscode.ExtensionContext) {

    const validateCommand = vscode.commands.registerCommand('calm-vscode.validate', async () => {
        const diagnosticCollection = languages.createDiagnosticCollection('calm');
        diagnosticCollection.clear();
        const editor = vscode.window.activeTextEditor;
        vscode.commands.executeCommand('editor.action.formatDocument');
        try {
            const data: string = editor?.document.getText();
            const absPath: string = editor?.document?.uri?.fsPath;
            if (data && vscode.window.activeTextEditor && _isCALMFile(data)) {
                diagnosticCollection.clear();
                const calmResult: ValidationOutcome = await _callCalmValidate(data, absPath);
                if (calmResult === undefined) {
                    console.error('Got \'undefined\' back from callCalmValidate - indicating we weren\'t able to complete validation.');
                } else {
                    const diagnostics: Diagnostic[] = calmResult.allValidationOutputs().map((calmValidation: ValidationOutput) => _mapTo(data, calmValidation));
                    diagnosticCollection.set(vscode.window.activeTextEditor.document.uri, diagnostics);
                }
            }
        } catch (error: unknown) {
            vscode.window.showErrorMessage('Error validating current file: ' + error);
        }
    });

    context.subscriptions.push(validateCommand);
    vscode.commands.executeCommand('calm-vscode.validate');
}

export function deactivate() { }

function _mapTo(jsonDataFromFile: string, calmValidation: ValidationOutput): vscode.Diagnostic {
    let { line_start, line_end, character_start, character_end } = calmValidation;
    if (calmValidation.line_start === undefined || (calmValidation.line_start === 1)) {
        const data = _getLineNumbers(jsonDataFromFile, calmValidation.path);
        if (data.length === 1) {
            line_start = data[0].line_start;
            line_end = data[0].line_end;
            character_start = data[0].character_start;
            character_end = data[0].character_end;
        }
    }

    return new Diagnostic(new Range(new vscode.Position(line_start, character_start), new vscode.Position(line_end, character_end)), calmValidation.message, _convertSeverity(calmValidation.severity));
}

async function _callCalmValidate(pageData: string, absFilePath: string): Promise<ValidationOutcome> {

    const schema = _singleValueFrom(pageData, '$.$schema');
    const id = _singleValueFrom(pageData, '$.$id');

    let instantiation = undefined;
    let pattern = undefined;

    //Hacky implementation - needs to be changed.
    if (schema?.includes('/pattern/') && id === undefined) {
        instantiation = absFilePath;
        pattern = schema;
    } else if (id?.includes('/pattern/')) {
        pattern = absFilePath;
    } else {
        return Promise.resolve(undefined);
    }
    //The pattern should refer to the version of CALM being used - so let's fetch.

    const schema_location = `https://raw.githubusercontent.com/finos/architecture-as-code/main/calm/draft/${CALM_DRAFT_VERSION}/meta/calm.json`;
    return await validate(instantiation, pattern, schema_location, false);
}

/**
 * Determine if the current file is CALM and should be attempted to be validated - visualized.
 * @param pageData Data on the current page.
 * @returns 
 */
function _isCALMFile(pageData: string): boolean {
    //Yes, this is extremely hacky - but it's simply to stop every save on any open JSON file assuming it's CALM.
    return pageData.includes('$schema') && pageData.includes('calm');
}

function _singleValueFrom(pageData: string, jsonPath: string): string {
    const { data: jsonObj } = jsonSourceMap.parse(pageData);
    const results = JSONPath({ path: jsonPath, json: jsonObj });
    if (results.length == 1) {
        return results[0];
    }
    return undefined;
}

function _convertSeverity(severityStr: string): DiagnosticSeverity {
    if (severityStr === 'error') {
        return DiagnosticSeverity.Error;
    } else if (severityStr === 'warning') {
        return DiagnosticSeverity.Warning;
    } else {
        return DiagnosticSeverity.Information;
    }
}

function _getLineNumbers(jsonStr: string, jsonPathExpr: string) {

    const { data: jsonObj, pointers } = jsonSourceMap.parse(jsonStr);
    const results = JSONPath({ path: _generatePath(jsonPathExpr.split('/')), json: jsonObj });

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

function _generatePath(arr) {
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
