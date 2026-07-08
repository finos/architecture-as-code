import { describe, it, expect, beforeEach } from 'vitest';
import path from 'path';
import { validate } from './validate.js';
import { FileSystemDocumentLoader } from '../../document-loader/file-system-document-loader.js';
import { InMemoryDocumentLoader } from '../../test/in-memory-document-loader.js';
import { SchemaDirectory } from '../../schema-directory.js';

const schemaDir_12 = path.join(__dirname, '../../../../calm/release/1.2/meta/');

const CYCLIC_ARCH_URL = 'https://calm.example.com/cyclic-arch.json';
const NESTED_ARCH_URL = 'https://calm.example.com/nested-arch.json';

function nodeWithDetail(detailUrl: string) {
    return {
        'unique-id': 'svc',
        'node-type': 'service',
        name: 'Service',
        description: 'a service with detailed architecture',
        details: { 'detailed-architecture': detailUrl }
    };
}

const topArchWithCycle = {
    'unique-id': 'top-cyclic',
    nodes: [nodeWithDetail(CYCLIC_ARCH_URL)],
    relationships: []
};

// The sub-architecture references itself, forming a cycle.
const cyclicSubArch = {
    'unique-id': 'cyclic-sub',
    nodes: [nodeWithDetail(CYCLIC_ARCH_URL)],
    relationships: []
};

const topArchNested = {
    'unique-id': 'top-nested',
    nodes: [nodeWithDetail(NESTED_ARCH_URL)],
    relationships: []
};

// A well-formed nested sub-architecture (no cycle, no errors).
const nestedSubArch = {
    'unique-id': 'nested-sub',
    nodes: [
        { 'unique-id': 'db', 'node-type': 'database', name: 'DB', description: 'a database' }
    ],
    relationships: []
};

describe('validate node-details E2E', () => {
    function schemaDirectoryWith(docs: Record<string, object>): SchemaDirectory {
        const fsLoader = new FileSystemDocumentLoader([schemaDir_12], false);
        return new SchemaDirectory(new InMemoryDocumentLoader(docs, fsLoader));
    }

    let schemaDirectory: SchemaDirectory;

    beforeEach(async () => {
        schemaDirectory = schemaDirectoryWith({
            [CYCLIC_ARCH_URL]: cyclicSubArch,
            [NESTED_ARCH_URL]: nestedSubArch
        });
        await schemaDirectory.loadSchemas();
    });

    it('terminates (does not hang or overflow) on a cyclic detailed-architecture', async () => {
        // Regression guard for the cycle bug: a pattern-less architecture whose
        // detailed-architecture references itself must terminate.
        const outcome = await validate(topArchWithCycle, undefined, undefined, schemaDirectory, false);
        expect(outcome).toBeDefined();
        // The cycle is detected and skipped, so validation completes without a stack overflow.
        expect(Array.isArray(outcome.jsonSchemaValidationOutputs)).toBe(true);
    }, 10000);

    it('recursively validates a well-formed nested detailed-architecture', async () => {
        const outcome = await validate(topArchNested, undefined, undefined, schemaDirectory, false);
        expect(outcome).toBeDefined();
        expect(outcome.hasErrors).toBe(false);
    });

    it('surfaces errors from an invalid nested detailed-architecture with a prefixed path', async () => {
        const invalidNested = {
            'unique-id': 'invalid-sub',
            nodes: [
                // node-type is required by the core schema; omit it to force an error
                { 'unique-id': 'broken', name: 'Broken', description: 'missing node-type' }
            ],
            relationships: []
        };
        schemaDirectory = schemaDirectoryWith({ [NESTED_ARCH_URL]: invalidNested });
        await schemaDirectory.loadSchemas();

        const outcome = await validate(topArchNested, undefined, undefined, schemaDirectory, false);
        expect(outcome.hasErrors).toBe(true);
        const prefixed = outcome.jsonSchemaValidationOutputs.some(o =>
            o.path.startsWith('/nodes/0/details/detailed-architecture')
        );
        expect(prefixed).toBe(true);
    });
});
