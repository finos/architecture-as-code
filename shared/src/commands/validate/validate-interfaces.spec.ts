import { validateAllInterfaces } from './validate-interfaces';
import { SchemaDirectory } from '../../schema-directory';
import { JsonSchemaValidator } from './json-schema-validator';

vi.mock('../../logger.js', () => ({
    initLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

const DEFINITION_URL = 'https://example.com/interface.json';

function makeSchemaDirectory(getSchema: () => Promise<object | undefined>): SchemaDirectory {
    return { getSchema: vi.fn().mockImplementation(getSchema) } as unknown as SchemaDirectory;
}

function architectureWithInterfaces(interfaces: object[]) {
    return {
        nodes: [{ 'unique-id': 'n1', 'node-type': 'service', name: 'N', description: 'D', interfaces }]
    };
}

const definitionInterface = { 'unique-id': 'i1', 'definition-url': DEFINITION_URL, config: { port: 1 } };

describe('validateAllInterfaces', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('ignores interface types without a definition-url', async () => {
        const schemaDirectory = makeSchemaDirectory(() => Promise.resolve(undefined));
        const arch = architectureWithInterfaces([{ 'unique-id': 'i1', hostname: 'example.com' }]);

        const result = await validateAllInterfaces(arch, schemaDirectory, false);

        expect(result).toEqual({ jsonSchemaOutputs: [], hasErrors: false, hasWarnings: false });
        expect(schemaDirectory.getSchema).not.toHaveBeenCalled();
    });

    it('returns nothing when the architecture cannot be parsed', async () => {
        const schemaDirectory = makeSchemaDirectory(() => Promise.resolve(undefined));

        const result = await validateAllInterfaces({ nodes: 'not-an-array' }, schemaDirectory, false);

        expect(result).toEqual({ jsonSchemaOutputs: [], hasErrors: false, hasWarnings: false });
    });

    it('warns when loading the definition throws', async () => {
        const schemaDirectory = makeSchemaDirectory(() => Promise.reject(new Error('network down')));

        const result = await validateAllInterfaces(architectureWithInterfaces([definitionInterface]), schemaDirectory, false);

        expect(result.hasErrors).toBe(false);
        expect(result.hasWarnings).toBe(true);
        expect(result.jsonSchemaOutputs).toHaveLength(1);
        expect(result.jsonSchemaOutputs[0].code).toBe('interface-definition-unresolved');
        expect(result.jsonSchemaOutputs[0].message).toContain('network down');
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/interfaces/0');
    });

    it('warns when the definition is not a valid JSON schema', async () => {
        const schemaDirectory = makeSchemaDirectory(() => Promise.resolve({ type: 'not-a-type' }));

        const result = await validateAllInterfaces(architectureWithInterfaces([definitionInterface]), schemaDirectory, false);

        expect(result.hasErrors).toBe(false);
        expect(result.hasWarnings).toBe(true);
        expect(result.jsonSchemaOutputs[0].code).toBe('interface-definition-unresolved');
        expect(result.jsonSchemaOutputs[0].message).toContain('Could not compile');
    });

    it('reports each interface at its own index', async () => {
        const schemaDirectory = makeSchemaDirectory(() => Promise.resolve({ type: 'object', required: ['host'] }));
        const arch = architectureWithInterfaces([
            { 'unique-id': 'plain', hostname: 'example.com' },
            definitionInterface
        ]);

        const result = await validateAllInterfaces(arch, schemaDirectory, false);

        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs).toHaveLength(1);
        expect(result.jsonSchemaOutputs[0].code).toBe('interface-definition-validation');
        expect(result.jsonSchemaOutputs[0].path).toBe('/nodes/0/interfaces/1/config');
    });

    it('loads an unreachable definition once but warns at each interface that uses it', async () => {
        const schemaDirectory = makeSchemaDirectory(() => Promise.reject(new Error('network down')));
        const arch = architectureWithInterfaces([
            definitionInterface,
            { ...definitionInterface, 'unique-id': 'i2' }
        ]);

        const result = await validateAllInterfaces(arch, schemaDirectory, false);

        expect(schemaDirectory.getSchema).toHaveBeenCalledTimes(1);
        expect(result.hasWarnings).toBe(true);
        expect(result.jsonSchemaOutputs.map(o => o.path)).toEqual(['/nodes/0/interfaces/0', '/nodes/0/interfaces/1']);
        expect(result.jsonSchemaOutputs.every(o => o.code === 'interface-definition-unresolved')).toBe(true);
    });

    it('loads and compiles a shared definition once and validates each interface against it', async () => {
        const initialize = vi.spyOn(JsonSchemaValidator.prototype, 'initialize');
        const schemaDirectory = makeSchemaDirectory(() => Promise.resolve({ type: 'object', required: ['host'] }));
        const arch = architectureWithInterfaces([
            definitionInterface,
            { ...definitionInterface, 'unique-id': 'i2' }
        ]);

        const result = await validateAllInterfaces(arch, schemaDirectory, false);

        expect(schemaDirectory.getSchema).toHaveBeenCalledTimes(1);
        expect(initialize).toHaveBeenCalledTimes(1);
        expect(result.hasErrors).toBe(true);
        expect(result.jsonSchemaOutputs.map(o => o.path)).toEqual(['/nodes/0/interfaces/0/config', '/nodes/0/interfaces/1/config']);
    });
});
