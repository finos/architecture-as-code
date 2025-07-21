// core.spec.ts
import { CalmCore } from './core.js';
import { CalmCoreSchema } from '../types/core-types.js';

const coreData: CalmCoreSchema = {
    nodes: [
        {
            'unique-id': 'node-001',
            'node-type': 'system',
            name: 'Test Node',
            description: 'This is a test node',
            details: {
                'detailed-architecture': 'https://example.com/architecture',
                'required-pattern': 'https://example.com/pattern'
            },
            interfaces: [
                { 'unique-id': 'interface-001', hostname: 'localhost' }
            ],
            controls: {
                'control-001': {
                    description: 'Test control',
                    requirements: [
                        {
                            'requirement-url': 'https://example.com/requirement',
                            'config-url': 'https://example.com/config'
                        }
                    ]
                }
            },
            metadata: [{ key: 'value' }]
        }
    ],
    relationships: [
        {
            'unique-id': 'relationship-001',
            description: 'Test Relationship',
            'relationship-type': {
                interacts: {
                    actor: 'actor-001',
                    nodes: ['node-001', 'node-002']
                }
            },
            protocol: 'HTTP',
            metadata: [{ key: 'value' }],
            controls: {
                'control-001': {
                    description: 'Test control',
                    requirements: [
                        {
                            'requirement-url': 'https://example.com/requirement',
                            'config-url': 'https://example.com/config'
                        }
                    ]
                }
            }
        }
    ],
    metadata: [{ key: 'value' }],
    controls: {
        'control-001': {
            description: 'Test control',
            requirements: [
                {
                    'requirement-url': 'https://example.com/requirement',
                    'config-url': 'https://example.com/config'
                }
            ]
        }
    },
    flows: [],
    adrs: ['http://adr1', 'http://adr2']
};

describe('CalmCore', () => {
    it('should create a CalmCore instance from full CoreSchema data', () => {
        const core = CalmCore.fromJson(coreData);

        expect(core).toBeInstanceOf(CalmCore);
        expect(core.nodes).toHaveLength(1);
        expect(core.relationships).toHaveLength(1);
        expect(core.metadata.data).toEqual({ key: 'value' });
        expect(core.controls).toHaveLength(1);
        expect(core.flows).toHaveLength(0);

        // New ADRs field
        expect(core.adrs).toEqual(['http://adr1', 'http://adr2']);
    });

    it('should handle missing optional fields (relationships, flows, adrs)', () => {
        const minimalData: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'node-002',
                    'node-type': 'service',
                    name: 'Another Node',
                    description: 'Another test node',
                    details: {
                        'detailed-architecture': '',
                        'required-pattern': ''
                    },
                    interfaces: [],
                    controls: {},
                    metadata: []
                }
            ],
            metadata: [],
            controls: {}
            // relationships, flows, adrs omitted
        };
        const core = CalmCore.fromJson(minimalData);

        expect(core).toBeInstanceOf(CalmCore);
        expect(core.nodes).toHaveLength(1);
        expect(core.relationships).toHaveLength(0);
        expect(core.flows).toHaveLength(0);
        expect(core.adrs).toEqual([]);
        expect(core.metadata.data).toEqual({});
        expect(core.controls).toHaveLength(0);
    });

    it('should default all collections when empty schema is passed', () => {
        const emptySchema: CalmCoreSchema = {};
        const core = CalmCore.fromJson(emptySchema);

        expect(core.nodes).toHaveLength(0);
        expect(core.relationships).toHaveLength(0);
        expect(core.controls).toHaveLength(0);
        expect(core.flows).toHaveLength(0);
        expect(core.adrs).toEqual([]);
        expect(core.metadata.data).toEqual({});
    });
});