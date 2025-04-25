import {describe, it, expect, vi, beforeEach, Mock} from 'vitest';
import * as fs from 'fs';
import { instantiate } from './instantiate'; // replace with actual relative path
import { SchemaDirectory } from '../../../schema-directory';

interface TestInstantiatedPattern {
    $schema?: string;
    nodes?: Array<Record<string, unknown>>;
    relationships?: Array<Record<string, unknown>>;
}


vi.mock('fs');

vi.mock('../../../logger', () => ({
    initLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
    }))
}));

const schemaDirMocks = vi.hoisted(() => ({
    loadSchemas: vi.fn(),
    loadCurrentPatternAsSchema: vi.fn(),
    getDefinition: vi.fn()
}));

vi.mock('../../../schema-directory', () => ({
    SchemaDirectory: vi.fn(() => ({
        loadSchemas: schemaDirMocks.loadSchemas,
        loadCurrentPatternAsSchema: schemaDirMocks.loadCurrentPatternAsSchema,
        getDefinition: schemaDirMocks.getDefinition
    })),
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
        (fs.readFileSync as Mock).mockImplementation(() => JSON.stringify(patternDocument));
    });

    it('instantiates architecture with correct schema', async () => {
        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: TestInstantiatedPattern = await instantiate(pattern, true,  new SchemaDirectory({} as any));

        expect(result.$schema).toEqual('test-pattern');
    });

    it('instantiates nodes with schema-required and const fields', async () => {
        const pattern = JSON.parse(fs.readFileSync(patternPath, { encoding: 'utf-8' }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: TestInstantiatedPattern = await instantiate(pattern, true,  new SchemaDirectory({} as any));

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
        const result: TestInstantiatedPattern = await instantiate(pattern, true,  new SchemaDirectory({} as any));

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
        const result: TestInstantiatedPattern = await instantiate(pattern, true, new SchemaDirectory({} as any));

        expect(result.nodes[0]['node-type']).toBe('[[ NODE_TYPE ]]');
        expect(result.nodes[0]['details']['arch']).toBe('[[ ARCH ]]');
    });
});
