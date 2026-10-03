import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runDiff, formatDiff, hasChanges, detectDocumentType, diffDocuments } from './diff.js';
import type { NodesAndRelationshipsDiffResult } from '@finos/calm-models/diff';
import type { TimelineInput } from '@finos/calm-models/diff';

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

const architectureWithLevelFields = (
    fields: Partial<{
        adrs: readonly string[];
        controls: Record<string, { description: string; requirements: readonly object[] }>;
        metadata: Record<string, unknown> | readonly Record<string, unknown>[];
    }>,
) => ({
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [{ 'unique-id': 'svc', 'node-type': 'service', name: 'Service' }],
    relationships: [],
    ...fields,
});

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

const emptyResult: NodesAndRelationshipsDiffResult = {
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

    it('reads two architecture files and returns a structured NodesAndRelationshipsDiffResult', async () => {
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
        const r: NodesAndRelationshipsDiffResult = { ...emptyResult, [key]: [{ placeholder: true }] as never };
        expect(hasChanges(r)).toBe(true);
    });

    it('returns true when only invalid nodes are present', () => {
        const r: NodesAndRelationshipsDiffResult = {
            ...emptyResult,
            invalidItems: { nodes: [{ name: 'no id' }], relationships: [] },
        };
        expect(hasChanges(r)).toBe(true);
    });

    it('returns true when only invalid relationships are present', () => {
        const r: NodesAndRelationshipsDiffResult = {
            ...emptyResult,
            invalidItems: { nodes: [], relationships: [{ description: 'no id' }] },
        };
        expect(hasChanges(r)).toBe(true);
    });

    it('returns true when only undiffable items are present', () => {
        const r: NodesAndRelationshipsDiffResult = {
            ...emptyResult,
            undiffableItems: { nodes: [{ name: 'unpinned' }], relationships: [] },
        };
        expect(hasChanges(r)).toBe(true);
    });

    it.each([
        ['ADR added', { adrs: ['adr-001', 'adr-002'] }, 'ADRs:          +1  -0  =1'],
        ['ADR removed', { adrs: [] }, 'ADRs:          +0  -1  =0'],
        ['control added', { controls: { encryption: { description: 'Enforce TLS', requirements: [] }, audit: { description: 'Record access', requirements: [] } } }, 'Controls:      +1  -0  ~0'],
        ['control removed', { controls: {} }, 'Controls:      +0  -1  ~0'],
        ['metadata added', { metadata: [{ owner: 'team-a' }, { owner: 'team-b' }] }, 'Metadata:      +1  -0  ~0'],
        ['metadata removed', { metadata: [] }, 'Metadata:      +0  -1  ~0'],
    ] as const)('returns true for real architecture-level %s changes', (_changeType, patch, summaryLine) => {
        const baseFields = {
            adrs: ['adr-001'],
            controls: { encryption: { description: 'Enforce TLS', requirements: [] } },
            metadata: [{ owner: 'team-a' }],
        };
        const baseline = architectureWithLevelFields(baseFields);
        const result = diffDocuments(baseline, architectureWithLevelFields({ ...baseFields, ...patch }), { format: 'summary' });

        expect(result.hasChanges).toBe(true);
        expect(hasChanges(result.diff)).toBe(true);
        expect(result.formatted).toContain(summaryLine);
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
        const r: NodesAndRelationshipsDiffResult = {
            ...emptyResult,
            invalidItems: { nodes: [{ a: 1 }], relationships: [{ b: 2 }, { c: 3 }] },
        };
        const out = formatDiff(r, 'summary');
        expect(out).toContain('Invalid items: 1 node(s) + 2 relationship(s)');
    });

    it('surfaces undiffable item counts in the summary view', () => {
        const r: NodesAndRelationshipsDiffResult = {
            ...emptyResult,
            undiffableItems: { nodes: [{ a: 1 }], relationships: [{ b: 2 }] },
        };
        const out = formatDiff(r, 'summary');
        expect(out).toContain('Undiffable items: 1 node(s) + 1 relationship(s)');
    });

    it('surfaces architecture-level ADR, control, and metadata counts in the summary view', () => {
        const r = {
            ...emptyResult,
            adrDiffItems: [
                { content: 'https://example.com/adr/001', changeType: 'unchanged' },
                { content: 'https://example.com/adr/002', changeType: 'added' },
            ],
            controlItemsAdded: {},
            controlItemsRemoved: {},
            controlItemsUnchanged: {},
            controlItemsModified: {
                security: {
                    descriptionDiff: [],
                    requirementsDiff: [],
                },
            },
            metadataObjectsAdded: [{ owner: 'team-b' }],
            metadataObjectsRemoved: [],
            metadataObjectsUnchanged: [],
            metadataObjectsModified: [],
        } as unknown as NodesAndRelationshipsDiffResult;

        const out = formatDiff(r, 'summary');
        expect(out).toContain('ADRs:          +1  -0  =1');
        expect(out).toContain('Controls:      +0  -0  ~1');
        expect(out).toContain('Metadata:      +1  -0  ~0');
        expect(out).toContain('ADRs added:\n  - https://example.com/adr/002');
        expect(out).toContain('Controls modified:\n  - security');
    });

    it('labels id-less pattern nodes by content instead of undefined', () => {
        const r: NodesAndRelationshipsDiffResult = {
            ...emptyResult,
            nodesAdded: [{ name: 'Worker', 'node-type': 'service' } as never],
        };
        const out = formatDiff(r, 'summary', 'pattern');
        expect(out).toContain('  - (unpinned service Worker)');
        expect(out).not.toContain('undefined');
    });
});

describe('diff core', () => {
    const archA = { nodes: [{ 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'x' }], relationships: [] };
    const archB = { nodes: [...archA.nodes, { 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'y' }], relationships: [] };

    it('diffs two architecture objects and formats a summary', async () => {
        const { diffDocuments } = await import('./diff-core');
        const result = diffDocuments(archA, archB, { format: 'summary' });
        expect(result.hasChanges).toBe(true);
        expect(result.diff.nodesAdded.map((n) => n['unique-id'])).toEqual(['b']);
        expect(result.formatted).toContain('Nodes added:');
    });

    it('uses labels in the mismatch error instead of file paths', async () => {
        const { diffDocuments } = await import('./diff-core');
        expect(() => diffDocuments(archA, archB, { documentType: 'pattern', labels: ['left.json', 'right.json'] }))
            .toThrow(/left\.json matches 'architecture'/);
    });

    it('diffs a timeline through an injected resolver', async () => {
        const { diffTimeline } = await import('./diff-core');
        const timeline = {
            'unique-id': 't',
            moments: [
                { 'unique-id': 'm1', details: { 'detailed-architecture': 'mem://a' } },
                { 'unique-id': 'm2', details: { 'detailed-architecture': 'mem://b' } },
            ],
        } as unknown as TimelineInput;
        const resolver = vi.fn(async (ref: string) => (ref === 'mem://a' ? archA : archB));
        const { diffs } = await diffTimeline(timeline, resolver);
        expect(resolver).toHaveBeenCalledWith('mem://a');
        expect(diffs).toHaveLength(1);
    });
});
