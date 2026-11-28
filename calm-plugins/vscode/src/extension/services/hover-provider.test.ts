import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { CalmIdHoverProvider, indexCalmIds } from './hover-provider';

const architecture = JSON.stringify(
    {
        nodes: [
            {
                'unique-id': 'api',
                'node-type': 'service',
                name: 'API Gateway',
                interfaces: [{ 'unique-id': 'api-http', url: 'https://api.example.com' }],
            },
            { 'unique-id': 'db', 'node-type': 'database', name: 'Orders DB' },
        ],
        relationships: [
            {
                'unique-id': 'api-uses-db',
                description: 'API reads orders',
                'relationship-type': { connects: { source: { node: 'api' }, destination: { node: 'db' } } },
            },
        ],
        flows: [{ 'unique-id': 'place-order', name: 'Place order', transitions: [] }],
        metadata: { owner: 'payments' },
    },
    null,
    2
);

type FakeRange = { start: { character: number }; end: { character: number }; text: string };

function fakeDocument(text: string): vscode.TextDocument {
    const lines = text.split('\n');
    return {
        getText: (range?: FakeRange) => (range ? range.text : text),
        lineAt: (line: number) => ({ text: lines[line] }),
        getWordRangeAtPosition: (position: { line: number; character: number }, pattern: RegExp) => {
            const line = lines[position.line];
            const global = new RegExp(pattern.source, 'g');
            for (const match of line.matchAll(global)) {
                const start = match.index ?? 0;
                const end = start + match[0].length;
                if (position.character >= start && position.character <= end) {
                    return { start: { character: start }, end: { character: end }, text: match[0] };
                }
            }
            return undefined;
        },
    } as unknown as vscode.TextDocument;
}

/** The position of the first character of the `occurrence`-th match of `needle`. */
function positionOf(text: string, needle: string, occurrence = 1): vscode.Position {
    const lines = text.split('\n');
    let seen = 0;
    for (let line = 0; line < lines.length; line++) {
        let from = 0;
        let index: number;
        while ((index = lines[line].indexOf(needle, from)) >= 0) {
            if (++seen === occurrence) return { line, character: index } as vscode.Position;
            from = index + 1;
        }
    }
    throw new Error(`${needle} not found`);
}

function hoverText(text: string, needle: string, occurrence = 1): string | undefined {
    const hover = new CalmIdHoverProvider().provideHover(fakeDocument(text), positionOf(text, needle, occurrence));
    return (hover?.contents as unknown as { value: string } | undefined)?.value;
}

describe('CalmIdHoverProvider', () => {
    it('describes a node where it is declared', () => {
        expect(hoverText(architecture, 'api"', 1)).toBe('**CALM id** `api`\n\nNode: API Gateway (service)');
    });

    it('describes a node where a relationship references it', () => {
        // The second "api" string is the relationship source.
        expect(hoverText(architecture, 'api"', 2)).toBe('**CALM id** `api`\n\nNode: API Gateway (service)');
    });

    it('describes interfaces, relationships and flows', () => {
        expect(hoverText(architecture, 'api-http')).toBe('**CALM id** `api-http`\n\nInterface: of node `api`');
        expect(hoverText(architecture, 'api-uses-db')).toBe('**CALM id** `api-uses-db`\n\nRelationship: API reads orders');
        expect(hoverText(architecture, 'place-order')).toBe('**CALM id** `place-order`\n\nFlow: Place order');
    });

    it('shows nothing for keys, other values and non-JSON text', () => {
        expect(hoverText(architecture, 'unique-id')).toBeUndefined();
        expect(hoverText(architecture, 'payments')).toBeUndefined();
        expect(hoverText('{ "nodes": [ "api"', 'api')).toBeUndefined();
    });
});

describe('indexCalmIds', () => {
    it('falls back to the relationship type when there is no description', () => {
        const ids = indexCalmIds({ relationships: [{ 'unique-id': 'r', 'relationship-type': { interacts: {} } }] });
        expect(ids.get('r')).toEqual({ kind: 'Relationship', detail: 'interacts' });
    });

    it('ignores documents that are not architectures', () => {
        expect(indexCalmIds([]).size).toBe(0);
        expect(indexCalmIds({ nodes: { api: {} } }).size).toBe(0);
    });
});
