import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CanvasPanel } from './canvas-panel';
import type { ExtToWebviewMessage, WebviewToExtMessage } from '../types/messages';

function makeDoc(filePath: string, initialText: string) {
    let text = initialText;
    return {
        uri: vscode.Uri.file(filePath),
        getText: () => text,
        setText: (next: string) => {
            text = next;
        },
        positionAt: (offset: number) => offset,
    };
}

describe('CanvasPanel detailed-architecture navigation (#3654)', () => {
    let tmpDir: string;
    let parentPath: string;
    let childPath: string;
    let standardNodePath: string;
    let docs: Map<string, ReturnType<typeof makeDoc>>;
    let shownDocs: Array<{ uri: string; column: vscode.ViewColumn | undefined }>;
    let appliedEdits: Array<{ uri: string; newText: string }>;
    let postedMessages: ExtToWebviewMessage[];
    let messageHandler: ((msg: WebviewToExtMessage) => void) | undefined;
    let saveListeners: Array<(doc: { uri: vscode.Uri }) => void>;
    let panel: CanvasPanel;

    const parentContent = JSON.stringify({
        nodes: [
            {
                'unique-id': 'calm-hub',
                'node-type': 'service',
                name: 'CALM Hub API',
                description: 'Hub service',
                details: {
                    'detailed-architecture': 'calm-hub-detail.architecture.json',
                },
            },
        ],
        relationships: [],
    });

    const childContent = JSON.stringify({
        nodes: [
            {
                'unique-id': 'calm-hub-resources',
                'node-type': 'service',
                name: 'REST Resources Layer',
                description: 'JAX-RS resources',
            },
        ],
        relationships: [],
    });

    const standardNodeContent = JSON.stringify({
        nodes: [
            {
                'unique-id': 'std-svc',
                'node-type': 'service',
                name: 'Standard Service',
                description: 'Standard node',
            },
        ],
        relationships: [],
    });

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calm-canvas-panel-'));
        const sandboxDir = path.join(tmpDir, 'sandbox');
        const stdDir = path.join(tmpDir, 'standard-nodes');
        fs.mkdirSync(sandboxDir, { recursive: true });
        fs.mkdirSync(stdDir, { recursive: true });

        // Write files before resolving real paths so macOS /var -> /private/var matches
        fs.writeFileSync(path.join(sandboxDir, 'calm-3.architecture.json'), parentContent);
        fs.writeFileSync(path.join(sandboxDir, 'calm-hub-detail.architecture.json'), childContent);
        fs.writeFileSync(path.join(stdDir, 'std-svc.calm.json'), standardNodeContent);

        parentPath = fs.realpathSync(path.join(sandboxDir, 'calm-3.architecture.json'));
        childPath = fs.realpathSync(path.join(sandboxDir, 'calm-hub-detail.architecture.json'));
        standardNodePath = fs.realpathSync(path.join(stdDir, 'std-svc.calm.json'));

        docs = new Map([
            [parentPath, makeDoc(parentPath, parentContent)],
            [childPath, makeDoc(childPath, childContent)],
            [standardNodePath, makeDoc(standardNodePath, standardNodeContent)],
        ]);
        shownDocs = [];
        appliedEdits = [];
        postedMessages = [];
        messageHandler = undefined;
        saveListeners = [];
        vscode.window.visibleTextEditors = [];
        vscode.window.activeTextEditor = undefined;

        vscode.workspace.onDidSaveTextDocument = (cb: (doc: { uri: vscode.Uri }) => void) => {
            saveListeners.push(cb);
            return { dispose: () => {} };
        };

        vscode.workspace.workspaceFolders = [
            { uri: vscode.Uri.file(fs.realpathSync(tmpDir)) },
        ];

        vscode.workspace.openTextDocument = async (uri: vscode.Uri) => {
            const existing = docs.get(uri.fsPath);
            if (existing) return existing;
            const diskText = fs.readFileSync(uri.fsPath, 'utf-8');
            const created = makeDoc(uri.fsPath, diskText);
            docs.set(uri.fsPath, created);
            return created;
        };

        vscode.workspace.fs.readFile = async (uri: vscode.Uri) =>
            Buffer.from(fs.readFileSync(uri.fsPath, 'utf-8'));

        vscode.workspace.applyEdit = async (edit: vscode.WorkspaceEdit) => {
            for (const entry of edit.edits) {
                const uri = (entry.uri as vscode.Uri).fsPath;
                appliedEdits.push({ uri, newText: entry.newText });
                docs.get(uri)?.setText(entry.newText);
            }
            return true;
        };

        (vscode.window as unknown as { showTextDocument: unknown }).showTextDocument = async (
            doc: { uri: vscode.Uri },
            column?: vscode.ViewColumn
        ) => {
            shownDocs.push({ uri: doc.uri.fsPath, column });
            return undefined;
        };

        (vscode.window as unknown as { createWebviewPanel: unknown }).createWebviewPanel = () => ({
            webview: {
                html: '',
                cspSource: 'vscode-webview:',
                asWebviewUri: (uri: vscode.Uri) => uri,
                postMessage: async (msg: ExtToWebviewMessage) => {
                    postedMessages.push(msg);
                    return true;
                },
                onDidReceiveMessage: (cb: (msg: WebviewToExtMessage) => void) => {
                    messageHandler = cb;
                    return { dispose: () => {} };
                },
            },
            reveal: () => {},
            onDidDispose: () => ({ dispose: () => {} }),
            dispose: () => {},
        });

        const context = {
            subscriptions: [],
            extensionUri: vscode.Uri.file('/tmp/ext'),
        } as unknown as vscode.ExtensionContext;

        panel = new CanvasPanel(
            context,
            vscode.window.createOutputChannel('test')
        );
    });

    afterEach(() => {
        panel.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
        vi.restoreAllMocks();
    });

    it('opens the child detailed-architecture in the editor and applies subsequent canvas edits to the child, not the parent', async () => {
        const parentDoc = docs.get(parentPath)!;
        panel.reveal(parentDoc as unknown as vscode.TextDocument);

        messageHandler!({
            type: 'drillInto',
            label: 'CALM Hub API',
            path: 'calm-hub-detail.architecture.json',
            calmType: 'service',
        });

        await vi.waitFor(() => {
            expect(
                postedMessages.some((m) => m.type === 'drillResult')
            ).toBe(true);
        });

        expect(shownDocs).toEqual([
            { uri: childPath, column: vscode.ViewColumn.One },
        ]);

        const drillMsg = postedMessages.find((m) => m.type === 'drillResult');
        expect(drillMsg).toEqual({
            type: 'drillResult',
            json: childContent,
            label: 'CALM Hub API',
            filePath: childPath,
            readonly: false,
        });

        // Simulate ReactFlow layout/canvasChanged emission while viewing the child architecture
        const updatedChildJson = JSON.stringify({
            ...JSON.parse(childContent),
            metadata: { _layout: { 'calm-hub-resources': { x: 10, y: 20 } } },
        });
        messageHandler!({
            type: 'canvasChanged',
            json: updatedChildJson,
        });

        expect(appliedEdits).toEqual([
            { uri: childPath, newText: updatedChildJson },
        ]);
        expect(docs.get(parentPath)!.getText()).toBe(parentContent);
        expect(docs.get(childPath)!.getText()).toBe(updatedChildJson);
    });

    it('restores the parent document in the editor and canvas when drilling back up to Root', async () => {
        const parentDoc = docs.get(parentPath)!;
        panel.reveal(parentDoc as unknown as vscode.TextDocument);

        messageHandler!({
            type: 'drillInto',
            label: 'CALM Hub API',
            path: 'calm-hub-detail.architecture.json',
            calmType: 'service',
        });

        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'drillResult')).toBe(true);
        });

        postedMessages.length = 0;
        shownDocs.length = 0;

        messageHandler!({
            type: 'drillUp',
            index: 0,
        });

        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'modelUpdated')).toBe(true);
        });

        expect(shownDocs).toEqual([
            { uri: parentPath, column: vscode.ViewColumn.One },
        ]);
        expect(postedMessages).toContainEqual({
            type: 'modelUpdated',
            json: parentContent,
            source: 'file',
        });

        // Edits after drilling back to Root apply to the parent document
        const updatedParentJson = JSON.stringify({
            ...JSON.parse(parentContent),
            metadata: { _layout: { 'calm-hub': { x: 50, y: 60 } } },
        });
        messageHandler!({
            type: 'canvasChanged',
            json: updatedParentJson,
        });

        expect(appliedEdits).toEqual([
            { uri: parentPath, newText: updatedParentJson },
        ]);
        expect(docs.get(parentPath)!.getText()).toBe(updatedParentJson);
        expect(docs.get(childPath)!.getText()).toBe(childContent);
    });

    it('keeps standard-node drill-in read-only and blocks canvasChanged writes', async () => {
        const parentDoc = docs.get(parentPath)!;
        panel.reveal(parentDoc as unknown as vscode.TextDocument);

        messageHandler!({
            type: 'drillInto',
            label: 'Standard Service',
            path: 'standard-nodes/std-svc.calm.json',
            calmType: 'standard-node:std-svc',
        });

        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'drillResult')).toBe(true);
        });

        expect(shownDocs).toEqual([]);
        const drillMsg = postedMessages.find((m) => m.type === 'drillResult');
        expect(drillMsg).toEqual({
            type: 'drillResult',
            json: standardNodeContent,
            label: 'Standard Service',
            filePath: standardNodePath,
            readonly: true,
        });

        messageHandler!({
            type: 'canvasChanged',
            json: standardNodeContent,
        });

        expect(appliedEdits).toEqual([]);
        expect(docs.get(parentPath)!.getText()).toBe(parentContent);

        // Saving the parent document while viewing a read-only standard node does not overwrite the canvas view
        postedMessages.length = 0;
        for (const listener of saveListeners) {
            listener({ uri: vscode.Uri.file(parentPath) });
        }
        await new Promise((r) => setTimeout(r, 10));
        expect(postedMessages.some((m) => m.type === 'modelUpdated')).toBe(false);
    });

    it('reuses the root editor viewColumn when drilling in and back up', async () => {
        const parentDoc = docs.get(parentPath)!;
        vscode.window.visibleTextEditors = [
            { document: { uri: parentDoc.uri }, viewColumn: vscode.ViewColumn.Two },
        ];
        panel.reveal(parentDoc as unknown as vscode.TextDocument);

        messageHandler!({
            type: 'drillInto',
            label: 'CALM Hub API',
            path: 'calm-hub-detail.architecture.json',
            calmType: 'service',
        });
        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'drillResult')).toBe(true);
        });

        expect(shownDocs).toEqual([
            { uri: childPath, column: vscode.ViewColumn.Two },
        ]);

        // Simulate user moving the child editor tab to ViewColumn.One before drilling back up
        vscode.window.visibleTextEditors = [
            { document: { uri: vscode.Uri.file(childPath) }, viewColumn: vscode.ViewColumn.One },
        ];

        shownDocs.length = 0;
        postedMessages.length = 0;
        messageHandler!({
            type: 'drillUp',
            index: 0,
        });
        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'modelUpdated')).toBe(true);
        });

        expect(shownDocs).toEqual([
            { uri: parentPath, column: vscode.ViewColumn.One },
        ]);
    });

    it('restores an intermediate detailed-architecture when drilling up to level > 0, and falls back to root if missing', async () => {
        const parentDoc = docs.get(parentPath)!;
        panel.reveal(parentDoc as unknown as vscode.TextDocument);

        // Drill into child architecture (level 1), then standard node (level 2)
        messageHandler!({
            type: 'drillInto',
            label: 'CALM Hub API',
            path: 'calm-hub-detail.architecture.json',
            calmType: 'service',
        });
        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'drillResult')).toBe(true);
        });

        postedMessages.length = 0;
        messageHandler!({
            type: 'drillInto',
            label: 'Standard Service',
            path: 'standard-nodes/std-svc.calm.json',
            calmType: 'standard-node:std-svc',
        });
        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'drillResult')).toBe(true);
        });

        postedMessages.length = 0;
        shownDocs.length = 0;

        // Drill up to level 1 (child architecture)
        messageHandler!({
            type: 'drillUp',
            index: 1,
            filePath: childPath,
            readonly: false,
        });
        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'modelUpdated')).toBe(true);
        });

        expect(shownDocs).toEqual([
            { uri: childPath, column: vscode.ViewColumn.One },
        ]);
        expect(postedMessages).toContainEqual({
            type: 'modelUpdated',
            json: childContent,
            source: 'file',
        });

        // If drillUp to an unreadable file fails, it falls back to rootDocument
        postedMessages.length = 0;
        shownDocs.length = 0;
        messageHandler!({
            type: 'drillUp',
            index: 1,
            filePath: path.join(tmpDir, 'nonexistent.architecture.json'),
            readonly: false,
        });
        await vi.waitFor(() => {
            expect(postedMessages.some((m) => m.type === 'modelUpdated')).toBe(true);
        });

        expect(shownDocs).toEqual([
            { uri: parentPath, column: vscode.ViewColumn.One },
        ]);
        expect(postedMessages).toContainEqual({
            type: 'modelUpdated',
            json: parentContent,
            source: 'file',
        });
    });
});
