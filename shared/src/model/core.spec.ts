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
            interfaces: [{ 'unique-id': 'interface-001', hostname: 'localhost'}],
            controls: { 'control-001': { description: 'Test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement', 'control-config-url': 'https://example.com/config' }] } },
            metadata: [{ key: 'value' }],
            'data-classification': 'Public',
            'run-as': 'admin',
            instance: 'instance-1'
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
            authentication: 'OAuth2',
            metadata: [{ key: 'value' }],
            controls: { 'control-001': { description: 'Test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement', 'control-config-url': 'https://example.com/config' }] } }
        }
    ],
    metadata: [{ key: 'value' }],
    controls: { 'control-001': { description: 'Test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement', 'control-config-url': 'https://example.com/config' }] } },
    flows: []
};

describe('CalmCore', () => {
    it('should create a CalmCore instance from CoreSchema data', () => {
        const core = CalmCore.fromJson(coreData);

        expect(core).toBeInstanceOf(CalmCore);
        expect(core.nodes).toHaveLength(1);
        expect(core.relationships).toHaveLength(1);
        expect(core.metadata).toEqual({ data: { key: 'value' } });
        expect(core.controls).toHaveLength(1);
        expect(core.controls[0].controlId).toBe('control-001');
        expect(core.flows).toHaveLength(0);
    });

    it('should handle optional fields in CalmCore', () => {
        const coreDataWithoutOptionalFields: CalmCoreSchema = {
            nodes: [
                {
                    'unique-id': 'node-002',
                    'node-type': 'service',
                    name: 'Another Test Node',
                    description: 'Another test node description',
                    details: {
                        'detailed-architecture': 'https://example.com/architecture-2',
                        'required-pattern': 'https://example.com/pattern-2'
                    },
                    interfaces: [{ 'unique-id': 'interface-001', hostname: 'localhost'}],
                    controls: { 'control-002': { description: 'Another test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement2', 'control-config-url': 'https://example.com/config2' }] } },
                    metadata: [{ key: 'value' }]
                }
            ],
            metadata: [{ key: 'value' }],
            controls: { 'control-002': { description: 'Another test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement2', 'control-config-url': 'https://example.com/config2' }] } },
        };

        const coreWithoutOptionalFields = CalmCore.fromJson(coreDataWithoutOptionalFields);

        expect(coreWithoutOptionalFields).toBeInstanceOf(CalmCore);
        expect(coreWithoutOptionalFields.nodes).toHaveLength(1);
        expect(coreWithoutOptionalFields.relationships).toHaveLength(0);
        expect(coreWithoutOptionalFields.flows).toHaveLength(0);
    });
});
