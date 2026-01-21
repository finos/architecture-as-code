import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flattenAllOf } from './flatten-allof';
import { SchemaDirectory } from '../../../schema-directory';

// Mock SchemaDirectory
const mockSchemaDir = {
    getDefinition: vi.fn(),
} as unknown as SchemaDirectory;

describe('flattenAllOf', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return schema unchanged when no allOf present', async () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string' }
            }
        };

        const result = await flattenAllOf(schema, mockSchemaDir);
        expect(result).toEqual(schema);
    });

    it('should merge properties from allOf schemas', async () => {
        const schema = {
            allOf: [
                {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                },
                {
                    properties: {
                        description: { type: 'string' }
                    }
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir);
        expect(result).toEqual({
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string' }
            }
        });
    });

    it('should combine required arrays from allOf schemas', async () => {
        const schema = {
            allOf: [
                {
                    type: 'object',
                    required: ['name']
                },
                {
                    required: ['description', 'name'] // duplicate 'name' to test dedup
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir) as { required: string[] };
        expect(result.required).toContain('name');
        expect(result.required).toContain('description');
        expect(result.required.length).toBe(2); // no duplicates
    });

    it('should resolve $ref in allOf schemas', async () => {
        const referencedSchema = {
            type: 'object',
            properties: {
                costCenter: { type: 'string' }
            },
            required: ['costCenter']
        };

        (mockSchemaDir.getDefinition as ReturnType<typeof vi.fn>).mockResolvedValueOnce(referencedSchema);

        const schema = {
            allOf: [
                { $ref: 'https://example.com/base-schema.json' },
                {
                    properties: {
                        name: { type: 'string' }
                    }
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir);
        expect(result).toEqual({
            type: 'object',
            properties: {
                costCenter: { type: 'string' },
                name: { type: 'string' }
            },
            required: ['costCenter']
        });
    });

    it('should resolve root $ref without allOf', async () => {
        const referencedSchema = {
            type: 'object',
            properties: {
                baseField: { type: 'string' }
            }
        };

        (mockSchemaDir.getDefinition as ReturnType<typeof vi.fn>).mockResolvedValueOnce(referencedSchema);

        const schema = {
            $ref: 'https://example.com/base-schema.json',
            properties: {
                additionalField: { type: 'number' }
            }
        };

        const result = await flattenAllOf(schema, mockSchemaDir);
        expect(result).toEqual({
            type: 'object',
            properties: {
                baseField: { type: 'string' },
                additionalField: { type: 'number' }
            }
        });
    });

    it('should merge prefixItems arrays by position at top level', async () => {
        const schema = {
            allOf: [
                {
                    prefixItems: [
                        { properties: { id: { const: 'node-1' } } },
                        { properties: { id: { const: 'node-2' } } }
                    ]
                },
                {
                    prefixItems: [
                        { properties: { name: { const: 'Node One' } } }
                    ]
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir) as {
            prefixItems: Array<{ properties: Record<string, unknown> }>
        };
        
        // First item should have merged properties
        expect(result.prefixItems[0].properties).toEqual({
            id: { const: 'node-1' },
            name: { const: 'Node One' }
        });
        
        // Second item should remain from first schema only
        expect(result.prefixItems[1].properties).toEqual({
            id: { const: 'node-2' }
        });
    });

    it('should merge nested properties from allOf', async () => {
        // When properties are nested inside other objects, last one wins for the nested property
        const schema = {
            allOf: [
                {
                    properties: {
                        nodes: { type: 'array', minItems: 1 }
                    }
                },
                {
                    properties: {
                        relationships: { type: 'array', minItems: 2 }
                    }
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir) as {
            properties: Record<string, unknown>
        };
        
        // Properties from both allOf schemas should be merged
        expect(result.properties.nodes).toEqual({ type: 'array', minItems: 1 });
        expect(result.properties.relationships).toEqual({ type: 'array', minItems: 2 });
    });

    it('should preserve top-level fields like $id and $schema', async () => {
        const schema = {
            $id: 'https://example.com/my-pattern.json',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            title: 'My Pattern',
            allOf: [
                {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir) as Record<string, unknown>;
        expect(result.$id).toBe('https://example.com/my-pattern.json');
        expect(result.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
        expect(result.title).toBe('My Pattern');
    });

    it('should handle nested allOf structures', async () => {
        const schema = {
            allOf: [
                {
                    allOf: [
                        { properties: { level1: { type: 'string' } } },
                        { properties: { level2: { type: 'string' } } }
                    ]
                },
                {
                    properties: { level3: { type: 'string' } }
                }
            ]
        };

        const result = await flattenAllOf(schema, mockSchemaDir) as {
            properties: Record<string, unknown>
        };
        
        expect(result.properties).toEqual({
            level1: { type: 'string' },
            level2: { type: 'string' },
            level3: { type: 'string' }
        });
    });
});
