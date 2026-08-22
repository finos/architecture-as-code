import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flattenAllOf } from './flatten-allof';
import { SchemaDirectory } from '../../../schema-directory';

// Spy on the logger's debug and warn channels so discarded-key warnings can be asserted.
// Hoisted so the (hoisted) vi.mock factory below can reference them.
const { mockDebug, mockWarn } = vi.hoisted(() => ({ mockDebug: vi.fn(), mockWarn: vi.fn() }));
vi.mock('../../../logger', () => ({
    initLogger: () => ({
        log: vi.fn(),
        debug: mockDebug,
        info: vi.fn(),
        warn: mockWarn,
        error: vi.fn(),
    }),
}));

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

    describe('discarded-key warnings across allOf', () => {
        it('warns when two allOf branches each declare a nodes items catalog', async () => {
            // Both branches declare `properties.nodes.items`; the shallow properties
            // merge makes the later branch's catalog win and silently drops the first.
            const schema = {
                allOf: [
                    { properties: { nodes: { items: { oneOf: [{ const: 'a' }] } } } },
                    { properties: { nodes: { items: { oneOf: [{ const: 'b' }] } } } },
                ],
            };

            await flattenAllOf(schema, mockSchemaDir, true);

            expect(mockWarn).toHaveBeenCalledWith(
                expect.stringContaining('allOf merge on property \'nodes\' discarded keys [items] declared in an earlier branch')
            );
        });

        it('does not warn when only one allOf branch declares a catalog', async () => {
            const schema = {
                allOf: [
                    { properties: { nodes: { items: { oneOf: [{ const: 'a' }] } } } },
                    { properties: { relationships: { prefixItems: [] } } },
                ],
            };

            await flattenAllOf(schema, mockSchemaDir, true);

            expect(mockWarn).not.toHaveBeenCalled();
        });

        it('names prefixItems as discarded, not the catalog, when the catalog is in the later branch', async () => {
            // The later branch is the one that survives the merge, so it is the earlier
            // branch's prefixItems that is lost here — not the catalog that replaces it.
            const schema = {
                allOf: [
                    {
                        properties: {
                            nodes: {
                                type: 'array',
                                prefixItems: [{ properties: { 'unique-id': { const: 'a' } } }],
                            },
                        },
                    },
                    {
                        properties: {
                            nodes: {
                                type: 'array',
                                items: { oneOf: [{ properties: { 'unique-id': { const: 'b' } } }] },
                            },
                        },
                    },
                ],
            };

            await flattenAllOf(schema, mockSchemaDir, true);

            expect(mockWarn).toHaveBeenCalledWith(
                expect.stringContaining('allOf merge on property \'nodes\' discarded keys [prefixItems] declared in an earlier branch')
            );
        });

        it('warns and names [type, prefixItems] on a prefixItems + minItems collision with no catalog anywhere', async () => {
            const schema = {
                allOf: [
                    {
                        properties: {
                            nodes: {
                                type: 'array',
                                prefixItems: [{ properties: { 'unique-id': { const: 'a' } } }],
                            },
                        },
                    },
                    { properties: { nodes: { minItems: 1 } } },
                ],
            };

            await flattenAllOf(schema, mockSchemaDir, true);

            expect(mockWarn).toHaveBeenCalledWith(
                expect.stringContaining('allOf merge on property \'nodes\' discarded keys [type, prefixItems] declared in an earlier branch')
            );
        });

        it('does not warn on a $ref refinement where the resolved def and siblings both declare the same property', async () => {
            // allOf: [{ $ref: ..., properties: {...} }] is the idiomatic composition form:
            // refining a $ref'd definition with local sibling keys is ordinary JSON Schema,
            // not a lossy allOf-branch collision, even though it discards the same keys.
            const referencedSchema = {
                type: 'object',
                properties: {
                    nodes: {
                        type: 'array',
                        prefixItems: [{ properties: { 'unique-id': { const: 'ref-node' } } }],
                    },
                },
            };
            (mockSchemaDir.getDefinition as ReturnType<typeof vi.fn>).mockResolvedValueOnce(referencedSchema);

            const schema = {
                allOf: [
                    {
                        $ref: 'https://example.com/base-schema.json',
                        properties: {
                            nodes: { minItems: 1 },
                        },
                    },
                ],
            };

            await flattenAllOf(schema, mockSchemaDir, true);

            expect(mockWarn).not.toHaveBeenCalled();
        });
    });
});
