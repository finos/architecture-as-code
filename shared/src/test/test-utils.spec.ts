import { describe, it, expect } from 'vitest'
import { setCalmSchema, TEST_ALL_SCHEMA, TEST_1_1_SCHEMA_AND_ABOVE, TEST_1_2_SCHEMA_AND_ABOVE } from './test-utils'

describe('setCalmSchema', () => {
    describe('basic functionality', () => {
        it('should set $schema property for basic architecture', () => {
            const arch = {
                nodes: [],
                relationships: []
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.$schema).toBe('https://calm.finos.org/release/1.1/meta/calm.json')
        })

        it('should preserve original properties', () => {
            const arch = {
                nodes: [{ 'unique-id': 'node1', name: 'Node 1' }],
                relationships: [],
                metadata: { author: 'test' }
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.nodes).toEqual(arch.nodes)
            expect(result.relationships).toEqual(arch.relationships)
            expect(result.metadata).toEqual(arch.metadata)
        })
    })

    describe('$ref updating in release URLs', () => {
        it('should update $ref in release URLs', () => {
            const arch = {
                properties: {
                    nodes: {
                        $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node'
                    }
                }
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.properties.nodes.$ref).toBe('https://calm.finos.org/release/1.1/meta/core.json#/defs/node')
        })

        it('should update multiple $ref values in nested objects', () => {
            const arch = {
                properties: {
                    nodes: {
                        items: {
                            $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node'
                        }
                    },
                    relationships: {
                        items: {
                            $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship'
                        }
                    }
                }
            }
            const result = setCalmSchema(arch, '1.2')
            expect(result.properties.nodes.items.$ref).toBe(
                'https://calm.finos.org/release/1.2/meta/core.json#/defs/node'
            )
            expect(result.properties.relationships.items.$ref).toBe(
                'https://calm.finos.org/release/1.2/meta/core.json#/defs/relationship'
            )
        })

        it('should update $ref in array items', () => {
            const arch = {
                prefixItems: [
                    { $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node' },
                    { $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node' }
                ]
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.prefixItems[0].$ref).toBe('https://calm.finos.org/release/1.1/meta/core.json#/defs/node')
            expect(result.prefixItems[1].$ref).toBe('https://calm.finos.org/release/1.1/meta/core.json#/defs/node')
        })

        it('should handle deeply nested structures', () => {
            const arch = {
                properties: {
                    options: [
                        {
                            properties: {
                                nodes: {
                                    items: {
                                        allOf: [
                                            { $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node' },
                                            {
                                                properties: {
                                                    controls: {
                                                        $ref: 'https://calm.finos.org/release/1.0/meta/control.json#/defs/controls'
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.properties.options[0].properties.nodes.items.allOf[0].$ref).toBe(
                'https://calm.finos.org/release/1.1/meta/core.json#/defs/node'
            )
            expect(result.properties.options[0].properties.nodes.items.allOf[1].properties.controls.$ref).toBe(
                'https://calm.finos.org/release/1.1/meta/control.json#/defs/controls'
            )
        })
    })

    describe('preserving non-CALM references', () => {
        it('should preserve non-CALM $ref values', () => {
            const arch = {
                properties: {
                    custom: {
                        $ref: '#/defs/customType'
                    }
                }
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.properties.custom.$ref).toBe('#/defs/customType')
        })

        it('should preserve external non-CALM references', () => {
            const arch = {
                properties: {
                    external: {
                        $ref: 'https://example.com/schema.json#/defs/type'
                    }
                }
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.properties.external.$ref).toBe('https://example.com/schema.json#/defs/type')
        })

        it('should preserve relative references', () => {
            const arch = {
                properties: {
                    relative: {
                        $ref: 'schemas/common.json#/defs/string'
                    }
                }
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.properties.relative.$ref).toBe('schemas/common.json#/defs/string')
        })
    })

    describe('draft schema references', () => {
        it('should detect but not update draft URLs', () => {
            // Draft URLs match the pattern but replacement only handles release
            const arch = {
                properties: {
                    nodes: {
                        $ref: 'https://calm.finos.org/draft/2025-03/meta/core.json#/defs/node'
                    }
                }
            }
            const result = setCalmSchema(arch, '1.1')
            // Draft references should remain unchanged since replacement pattern only handles release
            expect(result.properties.nodes.$ref).toBe('https://calm.finos.org/draft/2025-03/meta/core.json#/defs/node')
        })
    })

    describe('edge cases', () => {
        it('should handle empty objects', () => {
            const arch = {}
            const result = setCalmSchema(arch, '1.1')
            expect(result.$schema).toBe('https://calm.finos.org/release/1.1/meta/calm.json')
        })

        it('should handle null and undefined values', () => {
            const arch = {
                nodes: null,
                description: undefined,
                relationships: []
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.nodes).toBeNull()
            expect(result.description).toBeUndefined()
        })

        it('should handle arrays at top level', () => {
            const arch = {
                items: [
                    { $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node' },
                    { name: 'item2', $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node' }
                ]
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.items[0].$ref).toBe('https://calm.finos.org/release/1.1/meta/core.json#/defs/node')
            expect(result.items[1].$ref).toBe('https://calm.finos.org/release/1.1/meta/core.json#/defs/node')
            expect(result.items[1].name).toBe('item2')
        })

        it('should handle primitive values without modification', () => {
            const arch = {
                title: 'Test Pattern',
                version: '1.0',
                enabled: true,
                count: 42
            }
            const result = setCalmSchema(arch, '1.1')
            expect(result.title).toBe('Test Pattern')
            expect(result.version).toBe('1.0')
            expect(result.enabled).toBe(true)
            expect(result.count).toBe(42)
        })

        it('should not modify original input object', () => {
            const arch = {
                properties: {
                    nodes: {
                        $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node'
                    }
                }
            }
            const originalRef = arch.properties.nodes.$ref
            setCalmSchema(arch, '1.1')
            expect(arch.properties.nodes.$ref).toBe(originalRef)
        })
    })

    describe('schema version handling', () => {
        it('should update $ref to different schema versions', () => {
            const arch = {
                $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node'
            }

            const v10Result = setCalmSchema(arch, '1.0')
            const v11Result = setCalmSchema(arch, '1.1')
            const v12Result = setCalmSchema(arch, '1.2')

            expect(v10Result.$ref).toBe('https://calm.finos.org/release/1.0/meta/core.json#/defs/node')
            expect(v11Result.$ref).toBe('https://calm.finos.org/release/1.1/meta/core.json#/defs/node')
            expect(v12Result.$ref).toBe('https://calm.finos.org/release/1.2/meta/core.json#/defs/node')
        })

        it('should set correct $schema property for each version', () => {
            const arch = { nodes: [], relationships: [] }

            const v10Result = setCalmSchema(arch, '1.0')
            const v11Result = setCalmSchema(arch, '1.1')
            const v12Result = setCalmSchema(arch, '1.2')

            expect(v10Result.$schema).toBe('https://calm.finos.org/release/1.0/meta/calm.json')
            expect(v11Result.$schema).toBe('https://calm.finos.org/release/1.1/meta/calm.json')
            expect(v12Result.$schema).toBe('https://calm.finos.org/release/1.2/meta/calm.json')
        })
    })

    describe('integration with TEST constants', () => {
        it('should export TEST_ALL_SCHEMA', () => {
            expect(TEST_ALL_SCHEMA).toBeDefined()
            expect(Array.isArray(TEST_ALL_SCHEMA)).toBe(true)
            expect(TEST_ALL_SCHEMA.length).toBeGreaterThan(0)
        })

        it('should export TEST_1_1_SCHEMA_AND_ABOVE', () => {
            expect(TEST_1_1_SCHEMA_AND_ABOVE).toBeDefined()
            expect(Array.isArray(TEST_1_1_SCHEMA_AND_ABOVE)).toBe(true)
            expect(TEST_1_1_SCHEMA_AND_ABOVE.length).toBeGreaterThan(0)
        })

        it('should export TEST_1_2_SCHEMA_AND_ABOVE', () => {
            expect(TEST_1_2_SCHEMA_AND_ABOVE).toBeDefined()
            expect(Array.isArray(TEST_1_2_SCHEMA_AND_ABOVE)).toBe(true)
            expect(TEST_1_2_SCHEMA_AND_ABOVE.length).toBeGreaterThan(0)
        })

        it('TEST_1_1_SCHEMA_AND_ABOVE should only contain versions >= 1.1', () => {
            TEST_1_1_SCHEMA_AND_ABOVE.forEach(versionArray => {
                const version = parseFloat(versionArray[0])
                expect(version).toBeGreaterThanOrEqual(1.1)
            })
        })

        it('TEST_1_2_SCHEMA_AND_ABOVE should only contain versions >= 1.2', () => {
            TEST_1_2_SCHEMA_AND_ABOVE.forEach(versionArray => {
                const version = parseFloat(versionArray[0])
                expect(version).toBeGreaterThanOrEqual(1.2)
            })
        })
    })

    describe('real-world pattern examples', () => {
        it('should update a realistic pattern with multiple $refs', () => {
            const pattern = {
                $schema: 'https://calm.finos.org/release/1.0/meta/calm.json',
                properties: {
                    nodes: {
                        type: 'array',
                        minItems: 5,
                        maxItems: 5,
                        prefixItems: [
                            {
                                $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node',
                                properties: {
                                    'unique-id': { const: 'web-frontend' }
                                }
                            },
                            {
                                $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/node',
                                properties: {
                                    'unique-id': { const: 'api-server' }
                                }
                            }
                        ]
                    },
                    relationships: {
                        type: 'array',
                        items: {
                            $ref: 'https://calm.finos.org/release/1.0/meta/core.json#/defs/relationship'
                        }
                    }
                }
            }

            const result = setCalmSchema(pattern, '1.1')

            expect(result.$schema).toBe('https://calm.finos.org/release/1.1/meta/calm.json')
            expect(result.properties.nodes.prefixItems[0].$ref).toBe(
                'https://calm.finos.org/release/1.1/meta/core.json#/defs/node'
            )
            expect(result.properties.nodes.prefixItems[1].$ref).toBe(
                'https://calm.finos.org/release/1.1/meta/core.json#/defs/node'
            )
            expect(result.properties.relationships.items.$ref).toBe(
                'https://calm.finos.org/release/1.1/meta/core.json#/defs/relationship'
            )
            expect(result.properties.nodes.type).toBe('array')
            expect(result.properties.nodes.prefixItems[0].properties['unique-id'].const).toBe('web-frontend')
        })
    })
})
