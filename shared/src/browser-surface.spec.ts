import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { validate, SchemaDirectory, buildBrowserDocumentLoader, formatOutput, generate, diffDocuments } from './browser';

// The spec itself reads the meta-schemas from disk; the code under test only ever sees objects.
const META_DIR = path.join(__dirname, '../../calm/release/1.2/meta');
const schemas: Record<string, object> = Object.fromEntries(
    readdirSync(META_DIR).filter((f) => f.endsWith('.json')).map((f) => {
        const doc = JSON.parse(readFileSync(path.join(META_DIR, f), 'utf-8'));
        return [doc.$id, doc];
    })
);

const validArch = {
    $schema: 'https://calm.finos.org/release/1.2/meta/calm.json',
    'unique-id': 'arch',
    nodes: [
        { 'unique-id': 'svc', 'node-type': 'service', name: 'Service', description: 'a service' },
        { 'unique-id': 'db', 'node-type': 'database', name: 'DB', description: 'a database' },
    ],
    relationships: [
        { 'unique-id': 'svc-db', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'db' } } } },
    ],
};

async function schemaDirectory(extra: Record<string, object> = {}): Promise<SchemaDirectory> {
    const dir = new SchemaDirectory(buildBrowserDocumentLoader({ documents: { ...schemas, ...extra }, allowRemote: false }));
    await dir.loadSchemas();
    return dir;
}

describe('browser entry point', () => {
    it('validates a well-formed architecture with schema + spectral rules through injected loaders', async () => {
        const outcome = await validate(validArch, undefined, undefined, await schemaDirectory());
        expect(outcome.hasErrors).toBe(false);
        expect(formatOutput(outcome, 'pretty')).toContain('No issues found');
    });

    it('reports a dangling relationship reference via the spectral rules', async () => {
        const broken = { ...validArch, relationships: [{ 'unique-id': 'x', 'relationship-type': { connects: { source: { node: 'svc' }, destination: { node: 'ghost' } } } }] };
        const outcome = await validate(broken, undefined, undefined, await schemaDirectory());
        expect(outcome.hasErrors).toBe(true);
        expect(outcome.spectralSchemaValidationOutputs.some((o) => /ghost/.test(o.message))).toBe(true);
    });

    it('refuses junit formatting with a clear error', async () => {
        const outcome = await validate(validArch, undefined, undefined, await schemaDirectory());
        expect(() => formatOutput(outcome, 'junit')).toThrow(/junit.*not available/i);
    });

    it('exposes the pure generate and diff cores', async () => {
        const pattern = { $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://x/p.json', type: 'object', properties: { nodes: { type: 'array', prefixItems: [] }, relationships: { type: 'array', prefixItems: [] } } };
        const generated = await generate(pattern, await schemaDirectory()) as { nodes: unknown[] };
        expect(generated.nodes).toEqual([]);
        expect(diffDocuments(validArch, { ...validArch, nodes: validArch.nodes.slice(0, 1) }).hasChanges).toBe(true);
    });
});
