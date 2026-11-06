import { describe, it, expect, beforeEach } from 'vitest';
import { validate } from './validate.js';
import { FileSystemDocumentLoader } from '../../document-loader/file-system-document-loader.js';
import { InMemoryDocumentLoader } from '../../test/in-memory-document-loader.js';
import { SchemaDirectory } from '../../schema-directory.js';
import { calmSchemaDir } from '../../test/test-utils';

const TEST_INTERFACE_URL = 'https://calm.example.com/interfaces/test-interface.json';
const MISSING_INTERFACE_URL = 'https://calm.example.com/interfaces/missing.json';

const testInterfaceSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: TEST_INTERFACE_URL,
    type: 'object',
    properties: {
        prop1: { type: 'string' },
        prop2: { type: 'integer' }
    },
    required: ['prop1', 'prop2']
};

function architectureWithInterface(definitionUrl: string, config: Record<string, unknown>) {
    return {
        'unique-id': 'arch',
        nodes: [
            {
                'unique-id': 'svc',
                'node-type': 'service',
                name: 'Service',
                description: 'a service with an interface definition',
                interfaces: [
                    { 'unique-id': 'svc-interface', 'definition-url': definitionUrl, config }
                ]
            }
        ],
        relationships: []
    };
}

describe('validate interface definitions E2E', () => {
    let schemaDirectory: SchemaDirectory;

    beforeEach(async () => {
        const fsLoader = new FileSystemDocumentLoader([calmSchemaDir()], false);
        schemaDirectory = new SchemaDirectory(new InMemoryDocumentLoader({ [TEST_INTERFACE_URL]: testInterfaceSchema }, fsLoader));
        await schemaDirectory.loadSchemas();
    });

    it('reports an error when the config misses a property the definition requires', async () => {
        const arch = architectureWithInterface(TEST_INTERFACE_URL, { prop1: 'value' });

        const outcome = await validate(arch, undefined, undefined, schemaDirectory, false);

        expect(outcome.hasErrors).toBe(true);
        const errors = outcome.jsonSchemaValidationOutputs.filter(o => o.code === 'interface-definition-validation');
        expect(errors).toHaveLength(1);
        expect(errors[0].severity).toBe('error');
        expect(errors[0].path).toBe('/nodes/0/interfaces/0/config');
        expect(errors[0].message).toContain('prop2');
    });

    it('reports the path of a config property with the wrong type', async () => {
        const arch = architectureWithInterface(TEST_INTERFACE_URL, { prop1: 'value', prop2: 'not-a-number' });

        const outcome = await validate(arch, undefined, undefined, schemaDirectory, false);

        const errors = outcome.jsonSchemaValidationOutputs.filter(o => o.code === 'interface-definition-validation');
        expect(errors).toHaveLength(1);
        expect(errors[0].path).toBe('/nodes/0/interfaces/0/config/prop2');
    });

    it('accepts a config that conforms to its definition', async () => {
        const arch = architectureWithInterface(TEST_INTERFACE_URL, { prop1: 'value', prop2: 42 });

        const outcome = await validate(arch, undefined, undefined, schemaDirectory, false);

        expect(outcome.hasErrors).toBe(false);
        expect(outcome.allValidationOutputs().filter(o => String(o.code).startsWith('interface-definition'))).toHaveLength(0);
    });

    it('warns, but does not fail, when the definition cannot be loaded', async () => {
        const arch = architectureWithInterface(MISSING_INTERFACE_URL, { anything: true });

        const outcome = await validate(arch, undefined, undefined, schemaDirectory, false);

        expect(outcome.hasErrors).toBe(false);
        expect(outcome.hasWarnings).toBe(true);
        const warnings = outcome.jsonSchemaValidationOutputs.filter(o => o.code === 'interface-definition-unresolved');
        expect(warnings).toHaveLength(1);
        expect(warnings[0].severity).toBe('warning');
        expect(warnings[0].path).toBe('/nodes/0/interfaces/0');
        expect(warnings[0].message).toContain(MISSING_INTERFACE_URL);
    });
});
