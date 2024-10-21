import * as assert from 'assert';
import * as vscode from 'vscode';
import { before, after } from 'mocha';
import * as path from 'path';


// Really not a fan of the code-base mixing Mocha and Jest - but vscode-test requires mocha and having both causes collisions.
suite('calm-vscode test suite', () => {

    //Test data definitions.
    const emptyJsonPath = path.resolve(__dirname, '../../test-fixtures/empty.json');
    const instansiationWithProblems = path.resolve(__dirname, '../../test-fixtures/instansiation-with-problems.json');


    suiteTeardown(() => {
        vscode.window.showInformationMessage('All tests done!');
    });

    suiteSetup(() => {
        vscode.window.showInformationMessage('Starting all tests.');
    });

    before(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    after(async () => {
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    });

    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('Activating the extension should register the validation command.', async () => {
        await _assertCommandExists('calm-vscode.validate');
    });

    test('Activating the extension should register the visualize command.', async () => {
        await _assertCommandExists('calm-vscode.visualize');
    });

    test('Opening an empty JSON file and calling validate should not create diagnostic issues', async () => {
        const diagnostics = await _callValidateAndReturnDiagnostics(emptyJsonPath);
        assert.strictEqual(diagnostics.length, 0, 'Diagnostics were found when they should not have been.');
    });

    test('Opening a CALM instansiation file with problems and calling validate should create diagnostic issues', async () => {
        const diagnostics = await _callValidateAndReturnDiagnostics(instansiationWithProblems);
        assert.ok(diagnostics.length > 0, 'Diagnostics were not found - and we expected them to be.');
    });

});

async function _callValidateAndReturnDiagnostics(testFilePath: string) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(testFilePath));
    const editor = await vscode.window.showTextDocument(document);
    assert.ok(editor, 'Failed to open the file.');
    await vscode.commands.executeCommand('calm-vscode.validate');
    return vscode.languages.getDiagnostics(document.uri);
}

async function _assertCommandExists(command: string) {
    const extension = vscode.extensions.getExtension('calm-vscode'); // Replace with your extension ID
    await extension?.activate();

    const commandRegistered = vscode.commands.getCommands(true).then((commands) => {
        return commands.includes(command); // Replace with the actual command
    });

    assert.ok(commandRegistered, 'The command was not registered.');
}

