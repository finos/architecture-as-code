import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { CanvasPanel } from './canvas-panel';
import type { HubClient } from '../services/hub-client';
import { ShaCacheService } from '../services/sha-cache-service';
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

    describe('Hub string resource ids', () => {
        const tags = { path: 'aws/prod', variant: 'markdown' };

        function hubClientFixture(standardId = 'aws/prod/gw'): HubClient {
            return {
                getBaseUrl: () => 'https://hub.example.com',
                getNamespaces: vi.fn().mockResolvedValue([{ name: 'finos' }]),
                getResources: vi.fn().mockImplementation((_ns: string, type: string) =>
                    Promise.resolve(type === 'standards'
                        ? [{ uniqueId: 'api-gateway', name: 'Gateway', id: standardId, tags: { path: 'aws/prod' } }]
                        : [])
                ),
                getVersions: vi.fn().mockResolvedValue(['v1']),
                getResourceAtVersion: vi.fn().mockResolvedValue({ nodes: [{ 'node-type': 'service', controls: {} }] }),
                getDomains: vi.fn().mockResolvedValue([]),
                getControlsForDomain: vi.fn().mockResolvedValue([]),
                resolveControlId: vi.fn(),
                getRequirementVersions: vi.fn().mockResolvedValue(['v1']),
                getRequirementAtVersion: vi.fn().mockResolvedValue({ properties: {} }),
            } as unknown as HubClient;
        }

        beforeEach(() => {
            panel.reveal(docs.get(parentPath)! as unknown as vscode.TextDocument);
            vi.spyOn(ShaCacheService.prototype, 'getPalette').mockResolvedValue(null);
            vi.spyOn(ShaCacheService.prototype, 'putPalette').mockResolvedValue(undefined);
            vi.spyOn(ShaCacheService.prototype, 'get').mockResolvedValue(null);
            vi.spyOn(ShaCacheService.prototype, 'put').mockResolvedValue(undefined);
        });

        it('uses the supplied Hub id and tags for requirement versions', async () => {
            const client = hubClientFixture();
            await panel.setHubConnection(client);
            messageHandler!({
                type: 'requestControlVersions', requestId: 'r1',
                domain: 'security', controlName: 'seg',
                hubId: 'aws/prod/seg', ...tags,
            });
            await vi.waitFor(() => {
                expect(postedMessages.some((m) => m.type === 'controlVersionsResult')).toBe(true);
            });
            expect(client.getRequirementVersions).toHaveBeenCalledWith('security', 'aws/prod/seg', tags);
            expect(client.resolveControlId).not.toHaveBeenCalled();
        });

        it('uses the supplied Hub id and tags when resolving a control', async () => {
            const client = hubClientFixture();
            await panel.setHubConnection(client);
            messageHandler!({
                type: 'requestControlResolve', requestId: 'r2',
                ref: 'security:controls:seg',
                hubId: 'aws/prod/seg', ...tags,
            });
            await vi.waitFor(() => {
                expect(postedMessages.some((m) => m.type === 'controlResolveResult')).toBe(true);
            });
            expect(client.getRequirementVersions).toHaveBeenCalledWith('security', 'aws/prod/seg', tags);
            expect(client.getRequirementAtVersion).toHaveBeenCalledWith('security', 'aws/prod/seg', 'v1', tags);
            expect(client.resolveControlId).not.toHaveBeenCalled();
        });

        it('appends path and variant to the Hub UI detail link', async () => {
            const client = hubClientFixture();
            await panel.setHubConnection(client);
            const openExternal = vi.fn();
            (vscode as unknown as { env: unknown }).env = { openExternal };
            (vscode.Uri as unknown as { parse: (value: string) => unknown }).parse = (value: string) => value;
            try {
                messageHandler!({
                    type: 'openControlInHub', ref: 'security:controls:seg',
                    hubId: 'aws/prod/seg', ...tags,
                });
                await vi.waitFor(() => expect(openExternal).toHaveBeenCalled());
                const url = openExternal.mock.calls[0][0] as string;
                expect(url).toBe(
                    'https://hub.example.com/#/security/controls/aws%2Fprod%2Fseg/detail?path=aws%2Fprod&variant=markdown'
                );
            } finally {
                delete (vscode as unknown as { env?: unknown }).env;
                delete (vscode.Uri as unknown as { parse?: unknown }).parse;
            }
        });

        it('resolves definitions with a string hubId and a tag-aware cache key', async () => {
            const client = hubClientFixture();
            await panel.setHubConnection(client);
            const cacheGet = vi.spyOn(ShaCacheService.prototype, 'get');
            const cachePut = vi.spyOn(ShaCacheService.prototype, 'put');

            messageHandler!({
                type: 'resolveDefinitionId', nodeId: 'n1',
                curie: 'finos:standards:api-gateway@v1',
            });
            await vi.waitFor(() => {
                expect(postedMessages.some((m) => m.type === 'definitionResolved')).toBe(true);
            });
            expect(client.getResourceAtVersion).toHaveBeenCalledWith(
                'finos', 'standards', 'aws/prod/gw', 'v1', { path: 'aws/prod' }
            );
            expect(cacheGet.mock.calls[0][3]).toBe('aws/prod/gw~aws/prod~');
            expect(cachePut.mock.calls[0][3]).toBe('aws/prod/gw~aws/prod~');
        });
    });
});
