import { describe, it, expect } from 'vitest';
import { validateArchitecture, diffArchitectures, commandSupport, ENGINE_VERSION, LabError } from './engine';

const valid = {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    nodes: [
        { 'unique-id': 'trading-ui', 'node-type': 'webclient', name: 'Trading UI', description: 'web client' },
        { 'unique-id': 'orders-api', 'node-type': 'service', name: 'Orders API', description: 'orders' },
    ],
    relationships: [
        { 'unique-id': 'ui-orders', 'relationship-type': { connects: { source: { node: 'trading-ui' }, destination: { node: 'orders-api' } } } },
    ],
};

describe('validateArchitecture', () => {
    it('accepts a valid architecture and returns pretty output', async () => {
        const result = await validateArchitecture(JSON.stringify(valid));
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.pretty).toContain('No issues found');
        expect(result.doc).toMatchObject({ nodes: expect.any(Array) });
    });

    it('reports a dangling relationship reference through the spectral rules', async () => {
        const broken = { ...valid, relationships: [{ 'unique-id': 'x', 'relationship-type': { connects: { source: { node: 'trading-ui' }, destination: { node: 'ghost' } } } }] };
        const result = await validateArchitecture(JSON.stringify(broken));
        expect(result.ok).toBe(false);
        expect(result.errors.some((issue) => /ghost/.test(issue.message))).toBe(true);
        expect(result.pretty).toContain('ERROR');
    });

    it('reports a schema violation with a JSON pointer path', async () => {
        // `node-type` is deliberately an open string in CALM 1.2, so a missing required property
        // is the schema violation to assert on. No relationships, so nothing dangles either.
        const bad = { ...valid, nodes: [{ 'unique-id': 'x', 'node-type': 'service', name: 'X' }], relationships: [] };
        const result = await validateArchitecture(JSON.stringify(bad));
        expect(result.ok).toBe(false);
        expect(result.errors[0].path).toMatch(/^\/nodes\/0/);
    });

    it('returns a parse error for invalid JSON', async () => {
        const result = await validateArchitecture('{ nope');
        expect(result.ok).toBe(false);
        expect(result.parseError).toMatch(/not valid JSON/);
        expect(result.issues).toEqual([]);
    });

    it('caps and dedupes issues', async () => {
        const many = { ...valid, nodes: Array.from({ length: 30 }, (_, i) => ({ 'unique-id': `n${i}` })) };
        const result = await validateArchitecture(JSON.stringify(many));
        expect(result.issues.length).toBeLessThanOrEqual(20);
        expect(new Set(result.issues.map((i) => `${i.path}|${i.message}`)).size).toBe(result.issues.length);
    });
});

describe('diffArchitectures', () => {
    it('summarises added nodes', () => {
        const a = { ...valid, nodes: valid.nodes.slice(0, 1), relationships: [] };
        const diff = diffArchitectures(JSON.stringify(a), JSON.stringify({ ...valid, relationships: [] }), ['a.json', 'b.json']);
        expect(diff.hasChanges).toBe(true);
        expect(diff.formatted).toContain('Nodes added:');
        expect(diff.formatted).toContain('orders-api');
    });

    it('reports no changes for identical documents', () => {
        const text = JSON.stringify(valid);
        expect(diffArchitectures(text, text, ['a', 'b']).hasChanges).toBe(false);
    });

    it('throws a LabError naming the file for invalid JSON', () => {
        expect(() => diffArchitectures('{', JSON.stringify(valid), ['left.json', 'right.json'])).toThrow(LabError);
        expect(() => diffArchitectures('{', JSON.stringify(valid), ['left.json', 'right.json'])).toThrow(/left\.json/);
    });
});

describe('capability manifest', () => {
    it('explains why docify is unavailable', () => {
        const support = commandSupport('docify');
        expect(support?.status).toBe('unsupported');
        expect(support && 'reason' in support ? support.reason : '').toMatch(/filesystem|headless browser/);
    });

    it('exposes the engine version', () => {
        expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+/);
    });
});
