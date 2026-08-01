import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import * as fs from 'fs';
import { instantiate } from './instantiate'; // replace with actual relative path
import { CalmChoice, selectChoices } from './options';
import { SchemaDirectory } from '../../../schema-directory';
import { DocumentLoader } from '../../../document-loader/document-loader';

interface TestInstantiatedPattern {
    $schema: string;
    nodes: Array<Record<string, unknown>>;
    relationships: Array<Record<string, unknown>>;
    [key: string]: unknown;
}


vi.mock('fs');

vi.mock('../../../logger', () => ({
    initLogger: vi.fn(function () { return {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    }; })
}));

const schemaDirMocks = vi.hoisted(() => ({
    loadSchemas: vi.fn(),
    loadCurrentPatternAsSchema: vi.fn(),
    getDefinition: vi.fn()
}));

vi.mock('../../../schema-directory', () => ({
    SchemaDirectory: vi.fn(function () { return {
        loadSchemas: schemaDirMocks.loadSchemas,
        loadCurrentPatternAsSchema: schemaDirMocks.loadCurrentPatternAsSchema,
        getDefinition: schemaDirMocks.getDefinition
    }; }),
}));

async function getDefinitionMock(ref: string): Promise<object> {
    if (ref === 'schema#/defs/node') { //intentionally not using main schema as this instantiate should be generic
        return {
            required: ['node-type', 'details'],
            properties: {
                'node-type': { type: 'string' },
                'description': { type: 'string' },
                'details': {
                    type: 'object',
                    properties: {
                        arch: { type: 'string' }
                    },
                    required: ['arch']
                }
            }
        };
    }
    if (ref === 'schema#/defs/controls') {
        return {
            type: 'object',
            patternProperties: {
                '^[a-zA-Z0-9-]+$': {
                    type: 'object',
                    properties: {
                        description: { type: 'string' },
                        requirements: {
                            type: 'array',
                            items: { $ref: 'schema#/defs/details' }
                        }
                    },
                    required: ['description', 'requirements']
                }
            }
        };
    }
    if (ref === 'schema#/defs/details') {
        return{
            type: 'object',
            properties: {
                requirement: { type: 'string' },
                configUrl: { type: 'string' }
            },
            required: ['requirement', 'configUrl']
        };
    }
    return {};

}

schemaDirMocks.loadSchemas.mockImplementation(async () => {});

schemaDirMocks.loadCurrentPatternAsSchema.mockImplementation(async () => {});

schemaDirMocks.getDefinition.mockImplementation(getDefinitionMock);

describe('instantiate', () => {
    const patternPath = 'test-pattern.json';

    const patternDocument = {
        $schema: 'schema#',
        $id: 'test-pattern',
        properties: {
            nodes: {
                type: 'array',
                prefixItems: [
                    {
                        $ref: 'schema#/defs/node',
                        properties: {
                            'unique-id': { const: 'my-node' },
                            'description': { const: 'a test node' },
                            'details': {
                                type: 'object',
                                properties: {
                                    arch: { type: 'string' }
                                }
                            }
                        },
                        required: ['unique-id', 'details']
                    }
                ]
            },
            relationships: {
                type: 'array',
                prefixItems: [
                    {
                        properties: {
                            'unique-id': { const: 'rel-1' },
                            'controls': {
                                $ref: 'schema#/defs/controls',
                                properties: {
                                    security: {
                                        type: 'object',
                                        properties: {
                                            description: { const: 'security control' },
                                            requirements: {
                                                type: 'array',
                                                prefixItems: [
                                                    {
                                                        type: 'object',
                                                        $ref: 'schema#/defs/details',
                                                        properties: {
                                                            requirement: { const: 'requirement-1' }
                                                        },
                                                        required: ['configUrl']
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        required: ['unique-id', 'controls']
                    }
                ]
            }
        }
    };

    beforeEach(() => {
        vi.resetModules();
        (fs.readFileSync as Mock).mockImplementation(function () { return JSON.stringify(patternDocument); });
    });

    it('instantiates architecture with correct schema', async () => {
        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await instantiate(pattern, true,  new SchemaDirectory({} as any)) as TestInstantiatedPattern;

        expect(result.$schema).toEqual('test-pattern');
    });

    it('instantiates nodes with schema-required and const fields', async () => {
        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await instantiate(pattern, true,  new SchemaDirectory({} as any)) as TestInstantiatedPattern;

        expect(result.nodes[0]).toEqual({
            'unique-id': 'my-node',
            'description': 'a test node',
            'node-type': '[[ NODE_TYPE ]]',
            'details': {
                arch: '[[ ARCH ]]'
            }
        });
    });

    it('instantiates nested controls with patternProperties and consts', async () => {
        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await instantiate(pattern, true,  new SchemaDirectory({} as any)) as TestInstantiatedPattern;

        expect(result.relationships[0]).toEqual({
            'unique-id': 'rel-1',
            'controls': {
                security: {
                    description: 'security control',
                    requirements: [
                        {
                            requirement: 'requirement-1',
                            'configUrl': '[[ CONFIGURL ]]',
                        }
                    ]
                }
            }
        });
    });

    it('handles missing required schema fields by generating placeholders', async () => {
        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await instantiate(pattern, true, new SchemaDirectory({} as any)) as TestInstantiatedPattern;

        expect(result.nodes[0]['node-type']).toBe('[[ NODE_TYPE ]]');
        expect((result.nodes[0]['details'] as Record<string, unknown>)['arch']).toBe('[[ ARCH ]]');
    });

    it('uses const values directly for array items', async () => {
        // Define a pattern document with an array that contains items with const values
        const patternWithConstArrayItems = {
            $schema: 'schema#',
            $id: 'test-pattern-const-array',
            properties: {
                simpleArray: {
                    type: 'array',
                    prefixItems: [
                        { const: 'string-value' },
                        { const: 42 },
                        { const: true },
                        { const: null },
                        { const: { nestedKey: 'nested-value' } },
                        {
                            type: 'object',
                            properties: {
                                key: { type: 'string' }
                            },
                            required: ['key']
                        },
                        { const: [ 'nested-array' ]},
                    ]
                }
            }
        };

        (fs.readFileSync as Mock).mockImplementation(function () { return JSON.stringify(patternWithConstArrayItems); });

        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        const result = await instantiate(pattern, true, new SchemaDirectory(null as unknown as DocumentLoader)) as TestInstantiatedPattern;

        expect(result['simpleArray']).toEqual([
            'string-value',
            42,
            true,
            null,
            { nestedKey: 'nested-value' },
            { key: '[[ KEY ]]' }, // Non-const item should be instantiated with placeholder
            ['nested-array' ]
        ]);
    });

    it('handles const values at top level properties', async () => {
        // Test pattern with top-level const properties
        const patternWithTopLevelConst = {
            $schema: 'schema#',
            $id: 'test-pattern-top-level-const',
            properties: {
                'simple-const': { const: 'simple-value' },
                'object-const': { const: { nested: 'object-value' } },
                'array-const': { const: ['array', 'value'] },
                'number-const': { const: 42 },
                'boolean-const': { const: true },
                'null-const': { const: null },
                'mixed-property': {
                    type: 'object',
                    properties: {
                        'nested-const': { const: 'nested-value' },
                        'nested-placeholder': { type: 'string' }
                    }
                }
            }
        };

        (fs.readFileSync as Mock).mockImplementation(function () { return JSON.stringify(patternWithTopLevelConst); });

        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        const result = await instantiate(pattern, true, new SchemaDirectory(null as unknown as DocumentLoader)) as TestInstantiatedPattern;

        expect(result['simple-const']).toBe('simple-value');
        expect(result['object-const']).toEqual({ nested: 'object-value' });
        expect(result['array-const']).toEqual(['array', 'value']);
        expect(result['number-const']).toBe(42);
        expect(result['boolean-const']).toBe(true);
        expect(result['null-const']).toBeNull();
        expect(result['mixed-property']).toEqual({
            'nested-const': 'nested-value',
            'nested-placeholder': '[[ NESTED_PLACEHOLDER ]]'
        });
    });

    describe('items catalog (open oneOf/anyOf) support', () => {
        function catalogNode(id: string, description: string) {
            return {
                $ref: 'schema#/defs/node',
                properties: {
                    'unique-id': { const: id },
                    'description': { const: description },
                    'details': {
                        type: 'object',
                        properties: { arch: { type: 'string' } }
                    }
                },
                required: ['unique-id', 'details']
            };
        }

        const patternWithItemsCatalog = {
            $schema: 'schema#',
            $id: 'test-pattern-items-catalog',
            properties: {
                nodes: {
                    type: 'array',
                    prefixItems: [
                        {
                            $ref: 'schema#/defs/node',
                            properties: {
                                'unique-id': { const: 'webapp' },
                                'description': { const: 'the web app' },
                                'details': { type: 'object', properties: { arch: { type: 'string' } } }
                            },
                            required: ['unique-id', 'details']
                        }
                    ],
                    items: {
                        oneOf: [
                            catalogNode('cache', 'an optional cache'),
                            catalogNode('queue', 'an optional queue'),
                        ]
                    }
                },
                relationships: {
                    type: 'array',
                    prefixItems: []
                }
            }
        };

        it('instantiates an architecture containing exactly the chosen items-catalog nodes', async () => {
            const cacheChoice: CalmChoice = { description: 'Use cache', nodes: ['cache'], relationships: [] };
            const selected = selectChoices(patternWithItemsCatalog, [cacheChoice]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await instantiate(selected, true, new SchemaDirectory({} as any)) as TestInstantiatedPattern;

            const nodeIds = result.nodes.map((n) => n['unique-id']);
            expect(nodeIds).toEqual(['webapp', 'cache']);
        });

        it('yields only the mandatory nodes when no items-catalog candidates are selected', async () => {
            const selected = selectChoices(patternWithItemsCatalog, []);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await instantiate(selected, true, new SchemaDirectory({} as any)) as TestInstantiatedPattern;

            const nodeIds = result.nodes.map((n) => n['unique-id']);
            expect(nodeIds).toEqual(['webapp']);
        });

        it('does not throw for a nodes array with only an items catalog and no prefixItems', async () => {
            const catalogOnlyPattern = {
                $schema: 'schema#',
                $id: 'catalog-only-pattern',
                properties: {
                    nodes: {
                        type: 'array',
                        items: { oneOf: [catalogNode('cache', 'an optional cache')] }
                    },
                    relationships: { type: 'array', prefixItems: [] }
                }
            };
            const cacheChoice: CalmChoice = { description: 'Use cache', nodes: ['cache'], relationships: [] };
            const selected = selectChoices(catalogOnlyPattern, [cacheChoice]);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await instantiate(selected, true, new SchemaDirectory({} as any)) as TestInstantiatedPattern;

            expect(result.nodes.map((n) => n['unique-id'])).toEqual(['cache']);
        });
    });
});
