import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { CalmCanvasCodeLensProvider } from './codelens-provider';

function fakeDoc(text: string): vscode.TextDocument {
    return {
        getText: () => text,
        positionAt: (offset: number) => ({
            line: text.slice(0, offset).split('\n').length - 1,
            character: 0,
        }),
        uri: vscode.Uri.file('/ws/arch.calm.json'),
    } as unknown as vscode.TextDocument;
}

describe('CalmCanvasCodeLensProvider', () => {
    const provider = new CalmCanvasCodeLensProvider();

    it('returns no lenses for invalid JSON', () => {
        expect(provider.provideCodeLenses(fakeDoc('{ not json'))).toEqual([]);
    });

    it('returns no lenses for JSON without nodes or relationships', () => {
        expect(provider.provideCodeLenses(fakeDoc('{"foo":1}'))).toEqual([]);
    });

    it('adds a top-level "View in Canvas" lens for a CALM document', () => {
        const doc = fakeDoc(JSON.stringify({ nodes: [] }, null, 2));
        const lenses = provider.provideCodeLenses(doc);

        expect(lenses).toHaveLength(1);
        expect(lenses[0].command?.command).toBe('calm.openCanvas');
        expect(lenses[0].command?.title).toContain('View in CALM Canvas');
        expect(lenses[0].command?.arguments?.[0]).toBe(doc.uri);
    });

    it('adds one node-level lens per node with a unique-id', () => {
        const text = JSON.stringify(
            {
                nodes: [
                    { 'unique-id': 'svc-a' },
                    { 'unique-id': 'svc-b' },
                    { name: 'no-id' },
                ],
            },
            null,
            2
        );
        const lenses = provider.provideCodeLenses(fakeDoc(text));

        // 1 top-level + 2 node lenses (the node without unique-id is skipped)
        expect(lenses).toHaveLength(3);
        expect(
            lenses.every(
                (l) => l.command?.command === 'calm.openCanvas'
            )
        ).toBe(true);

        // The node lens is anchored on the line containing its unique-id.
        const svcALine =
            text.slice(0, text.indexOf('"unique-id": "svc-a"')).split('\n')
                .length - 1;
        const nodeLens = lenses[1] as unknown as {
            range: { startLine: number };
        };
        expect(nodeLens.range.startLine).toBe(svcALine);
    });
});
