import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runDiff, formatDiff, hasChanges, detectDocumentType } from './diff.js';
import type { DiffResult } from '@finos/calm-models/diff';

const loggerMock = {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
};

vi.mock('../../logger', () => ({
    initLogger: () => loggerMock,
}));

const archA = {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [
        { 'unique-id': 'a', 'node-type': 'service', name: 'A' },
        { 'unique-id': 'b', 'node-type': 'service', name: 'B' },
    ],
    relationships: [
        {
            'unique-id': 'a-to-b',
            description: 'A talks to B',
            'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } },
        },
    ],
};

const archB = {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [
        { 'unique-id': 'a', 'node-type': 'service', name: 'A v2' },
        { 'unique-id': 'c', 'node-type': 'service', name: 'C' },
    ],
    relationships: [
        {
            'unique-id': 'a-to-b',
            description: 'A talks to B',
            'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } },
        },
    ],
};

const makePattern = (nodeName: string) => ({
    $schema: 'https://calm.finos.org/release/1.0-rc2/meta/calm.json',
    type: 'object',
    properties: {
        nodes: {
            type: 'array',
            prefixItems: [
                {
                    properties: {
                        'unique-id': { const: 'svc-a' },
                        name: { const: nodeName },
                        'node-type': { const: 'service' },
                    },
                },
            ],
        },
        relationships: { type: 'array', prefixItems: [] },
    },
});

const emptyResult: DiffResult = {
    nodesAdded: [],
    nodesRemoved: [],
    nodesModified: [],
    nodesSame: [],
    nodesRenamed: [],
    edgesAdded: [],
    edgesRemoved: [],
    edgesModified: [],
    edgesSame: [],
    edgesRenamed: [],
};

describe('runDiff', () => {
    let workDir: string;

    beforeEach(() => {
        workDir = mkdtempSync(path.join(tmpdir(), 'calm-diff-'));
        loggerMock.warn.mockClear();
    });

    afterEach(() => {
        rmSync(workDir, { recursive: true, force: true });
    });

    const writeArch = (name: string, body: object) => {
        const p = path.join(workDir, name);
        writeFileSync(p, JSON.stringify(body));
        return p;
    };

    it('reads two architecture files and returns a structured DiffResult', async () => {
        const a = writeArch('a.json', archA);
        const b = writeArch('b.json', archB);

        const { diff, hasChanges: changed } = await runDiff(a, b);

        expect(changed).toBe(true);
        expect(diff.nodesAdded.map((n) => n['unique-id'])).toEqual(['c']);
        expect(diff.nodesRemoved.map((n) => n['unique-id'])).toEqual(['b']);
        expect(diff.nodesModified.map((n) => n.original['unique-id'])).toEqual(['a']);
    });

    it('reports no changes when comparing the same file to itself', async () => {
        const a = writeArch('a.json', archA);
        const { hasChanges: changed } = await runDiff(a, a);
        expect(changed).toBe(false);
    });

    it('writes the formatted output to outputPath when provided', async () => {
        const a = writeArch('a.json', archA);
        const b = writeArch('b.json', archB);
        const outFile = path.join(workDir, 'out', 'diff.json');

        const { formatted } = await runDiff(a, b, { format: 'json', outputPath: outFile });

        expect(existsSync(outFile)).toBe(true);
        expect(readFileSync(outFile, 'utf-8')).toBe(formatted);
    });

    it('emits a human-readable summary when format = summary', async () => {
        const a = writeArch('a.json', archA);
        const b = writeArch('b.json', archB);
        const { formatted } = await runDiff(a, b, { format: 'summary' });
        expect(formatted).toContain('CALM architecture diff');
        expect(formatted).toContain('Nodes added:');
        expect(formatted).toContain('  - c');
    });

    it('logs a warning when invalid items are detected and treats them as changes', async () => {
        const a = writeArch('a.json', archA);
        const b = writeArch('b-with-invalid.json', {
            ...archA,
            nodes: [...archA.nodes, { 'node-type': 'service', name: 'no id' }],
        });
        const result = await runDiff(a, b);
        expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        expect(loggerMock.warn.mock.calls[0][0]).toMatch(/missing a unique-id/);
        expect(result.hasChanges).toBe(true);
    });

    it('warns about undiffable pattern items and treats them as changes', async () => {
        const undiffablePattern = {
            $schema: 'https://calm.finos.org/release/1.0-rc2/meta/calm.json',
            type: 'object',
            properties: {
                nodes: {
                    type: 'array',
                    prefixItems: [
                        { properties: { 'unique-id': { const: 'svc-a' }, name: { const: 'A' }, 'node-type': { const: 'service' } } },
                        { properties: { 'unique-id': { type: 'string' } } },
                    ],
                },
                relationships: { type: 'array', prefixItems: [] },
            },
        };
        const a = writeArch('a.pattern.json', undiffablePattern);
        const b = writeArch('b.pattern.json', undiffablePattern);

        const result = await runDiff(a, b);

        expect(loggerMock.warn).toHaveBeenCalledTimes(1);
        expect(loggerMock.warn.mock.calls[0][0]).toMatch(/constrain no comparable content/);
        expect(result.hasChanges).toBe(true);
    });

    it('diffs two pattern files and reports a pattern-titled summary', async () => {
        const a = writeArch('a.pattern.json', makePattern('Service A'));
        const b = writeArch('b.pattern.json', makePattern('Service A v2'));

        const { diff, hasChanges: changed, formatted } = await runDiff(a, b, { format: 'summary' });

        expect(changed).toBe(true);
        expect(diff.nodesModified.map((n) => n.original['unique-id'])).toEqual(['svc-a']);
        expect(formatted).toContain('CALM pattern diff');
    });

    it('throws when the two inputs are different document types', async () => {
        const a = writeArch('a.json', archA);
        const b = writeArch('b.pattern.json', makePattern('Service A'));
        await expect(runDiff(a, b)).rejects.toThrow(/mismatched document types: architecture vs pattern/);
    });

    it('honours an explicit documentType override', async () => {
        const a = writeArch('a.pattern.json', makePattern('Service A'));
        const b = writeArch('b.pattern.json', makePattern('Service A'));
        const { hasChanges: changed } = await runDiff(a, b, { documentType: 'pattern' });
        expect(changed).toBe(false);
    });

    it('throws when a forced documentType conflicts with the document content', async () => {
        const a = writeArch('a.json', archA);
        const b = writeArch('b.json', archB);
        await expect(runDiff(a, b, { documentType: 'pattern' })).rejects.toThrow(
            /matches 'architecture'/,
        );
    });
});

describe('detectDocumentType', () => {
    it('classifies a document with top-level node/relationship arrays as an architecture', () => {
        expect(detectDocumentType(archA)).toBe('architecture');
    });

    it('classifies a JSON Schema document as a pattern', () => {
        expect(detectDocumentType(makePattern('Service A'))).toBe('pattern');
    });

    it('classifies a pattern wrapped in allOf as a pattern', () => {
        const allOfPattern = {
            $schema: 'https://calm.finos.org/release/1.0-rc2/meta/calm.json',
            allOf: [{ properties: { nodes: { type: 'array', prefixItems: [] } } }],
        };
        expect(detectDocumentType(allOfPattern)).toBe('pattern');
    });

    it('throws when the document matches neither an architecture nor a pattern', () => {
        expect(() => detectDocumentType({ $schema: 'something', title: 'mystery' })).toThrow(
            /Could not determine the CALM document type/,
        );
    });
});

describe('hasChanges', () => {
    it('returns false for an empty diff', () => {
        expect(hasChanges(emptyResult)).toBe(false);
    });

    it.each([
        ['nodesAdded'],
        ['nodesRemoved'],
        ['nodesModified'],
        ['nodesRenamed'],
        ['edgesAdded'],
        ['edgesRemoved'],
        ['edgesModified'],
        ['edgesRenamed'],
    ] as const)('returns true when %s has entries', (key) => {
        const r: DiffResult = { ...emptyResult, [key]: [{ placeholder: true }] as never };
        expect(hasChanges(r)).toBe(true);
    });

    it('returns true when only invalid nodes are present', () => {
        const r: DiffResult = {
            ...emptyResult,
            invalidItems: { nodes: [{ name: 'no id' }], relationships: [] },
        };
        expect(hasChanges(r)).toBe(true);
    });

    it('returns true when only invalid relationships are present', () => {
        const r: DiffResult = {
            ...emptyResult,
            invalidItems: { nodes: [], relationships: [{ description: 'no id' }] },
        };
        expect(hasChanges(r)).toBe(true);
    });

    it('returns true when only undiffable items are present', () => {
        const r: DiffResult = {
            ...emptyResult,
            undiffableItems: { nodes: [{ name: 'unpinned' }], relationships: [] },
        };
        expect(hasChanges(r)).toBe(true);
    });
});

describe('formatDiff', () => {
    it('produces parseable JSON when format = json', () => {
        const out = formatDiff(emptyResult, 'json');
        expect(() => JSON.parse(out)).not.toThrow();
    });

    it('omits empty sections in the summary view', () => {
        const out = formatDiff(emptyResult, 'summary');
        expect(out).toContain('CALM architecture diff');
        expect(out).not.toContain('Nodes added:');
    });

    it('surfaces invalid item counts in the summary view', () => {
        const r: DiffResult = {
            ...emptyResult,
            invalidItems: { nodes: [{ a: 1 }], relationships: [{ b: 2 }, { c: 3 }] },
        };
        const out = formatDiff(r, 'summary');
        expect(out).toContain('Invalid items: 1 node(s) + 2 relationship(s)');
    });

    it('surfaces undiffable item counts in the summary view', () => {
        const r: DiffResult = {
            ...emptyResult,
            undiffableItems: { nodes: [{ a: 1 }], relationships: [{ b: 2 }] },
        };
        const out = formatDiff(r, 'summary');
        expect(out).toContain('Undiffable items: 1 node(s) + 1 relationship(s)');
    });

    it('labels id-less pattern nodes by content instead of undefined', () => {
        const r: DiffResult = {
            ...emptyResult,
            nodesAdded: [{ name: 'Worker', 'node-type': 'service' } as never],
        };
        const out = formatDiff(r, 'summary', 'pattern');
        expect(out).toContain('  - (unpinned service Worker)');
        expect(out).not.toContain('undefined');
    });
});
