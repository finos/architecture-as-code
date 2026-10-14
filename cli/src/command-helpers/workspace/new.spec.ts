import { describe, it, expect, afterAll } from 'vitest';
import { getTemplatesForType, createNewDocument } from './new';
import { rm } from 'fs/promises';
import path from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import Ajv2020 from 'ajv/dist/2020.js';

const FLOW_DEFINITION_ID = 'https://calm.finos.org/release/1.2/meta/flow.json#/defs/flow';

// A standalone flow document carries `$schema` and `$id`, which the flow definition does not
// allow, so the body is checked against `#/defs/flow` without them. The 1.2 alias matches the
// template's `$schema`; `@finos/calm-schema` moves to each new release.
function flowDefinitionValidator() {
    const schemaDir = path.join(path.dirname(require.resolve('calm-schema-1.2/package.json')), 'schema');
    const ajv = new Ajv2020({ strict: false });
    for (const file of readdirSync(schemaDir).filter(f => f.endsWith('.json'))) {
        ajv.addSchema(JSON.parse(readFileSync(path.join(schemaDir, file), 'utf8')));
    }
    return ajv.getSchema(FLOW_DEFINITION_ID);
}

describe('getTemplatesForType', () => {
    it('returns template names for a known type', async () => {
        const templates = await getTemplatesForType('architecture');
        expect(templates).toContain('empty');
        expect(templates.every(t => !t.endsWith('.hbs'))).toBe(true);
    });

    it('returns empty array for an unknown type', async () => {
        const templates = await getTemplatesForType('nonexistent-type-xyz');
        expect(templates).toEqual([]);
    });

    it('returns all template types found in the templates dir', async () => {
        const types = ['architecture', 'pattern', 'schema'];
        for (const type of types) {
            const templates = await getTemplatesForType(type);
            expect(Array.isArray(templates)).toBe(true);
        }
    });
});

describe('createNewDocument', () => {
    const createdFiles: string[] = [];

    afterAll(async () => {
        for (const f of createdFiles) {
            if (existsSync(f)) {
                await rm(f);
            }
        }
    });

    const DOCUMENT_ID = 'https://h/calm/namespaces/ns/architectures/my-service/versions/1.0.0';

    it('creates a file named by the slug and returns its path', async () => {
        const filePath = await createNewDocument(DOCUMENT_ID, 'My Service', 'architecture', 'my-service');
        createdFiles.push(filePath);

        expect(existsSync(filePath)).toBe(true);
        expect(path.basename(filePath)).toBe('my-service.architecture.json');
    });

    it('renders the template with the document $id and title', async () => {
        const filePath = await createNewDocument(DOCUMENT_ID, 'My Arch', 'architecture', 'my-arch', 'empty');
        createdFiles.push(filePath);

        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        expect(parsed.$id).toBe(DOCUMENT_ID);
        expect(parsed.title).toBe('My Arch');
    });

    it('creates files for different types', async () => {
        for (const type of ['architecture', 'pattern']) {
            const filePath = await createNewDocument(DOCUMENT_ID, `Test ${type}`, type, `test-${type}`);
            createdFiles.push(filePath);
            expect(existsSync(filePath)).toBe(true);
            expect(filePath).toContain(`.${type}.json`);
        }
    });

    it('creates a flow that validates against the CALM flow definition', async () => {
        const flowId = 'https://h/calm/namespaces/ns/flows/my-flow/versions/1.0.0';
        const filePath = await createNewDocument(flowId, 'My Flow', 'flow', 'my-flow');
        createdFiles.push(filePath);

        const { $schema, $id, ...flow } = JSON.parse(readFileSync(filePath, 'utf8'));
        expect($schema).toBe('https://calm.finos.org/release/1.2/meta/flow.json');
        expect($id).toBe(flowId);
        expect(flow['unique-id']).toBe('my-flow');
        expect(flow.name).toBe('My Flow');

        const validateFlow = flowDefinitionValidator();
        expect(validateFlow, `${FLOW_DEFINITION_ID} not found`).toBeDefined();
        expect(validateFlow!(flow), JSON.stringify(validateFlow!.errors)).toBe(true);
    });

    it('throws if the output file already exists', async () => {
        const filePath = await createNewDocument(DOCUMENT_ID, 'My Arch', 'architecture', 'duplicate-guard');
        createdFiles.push(filePath);
        await expect(
            createNewDocument(DOCUMENT_ID, 'My Arch', 'architecture', 'duplicate-guard')
        ).rejects.toThrow('already exists');
    });

    it('throws for a slug containing a path separator', async () => {
        await expect(
            createNewDocument(DOCUMENT_ID, 'Bad', 'architecture', '../escape')
        ).rejects.toThrow('Invalid slug');
    });

    it('throws for a slug containing a Windows path separator', async () => {
        await expect(
            createNewDocument(DOCUMENT_ID, 'Bad', 'architecture', 'sub\\dir')
        ).rejects.toThrow('Invalid slug');
    });
});
