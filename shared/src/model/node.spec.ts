import { CalmNode, CalmNodeDetails } from './node.js';
import {CalmNodeSchema} from '../types/core-types.js';

const nodeData: CalmNodeSchema = {
    'unique-id': 'node-001',
    'node-type': 'system',
    name: 'Test Node',
    description: 'This is a test node',
    details: {
        'detailed-architecture': 'https://example.com/architecture',
        'required-pattern': 'https://example.com/pattern'
    },
    interfaces: [
        { 'unique-id': 'interface-001', host: 'localhost', port: 8080 },
        { 'unique-id': 'interface-002', port: 8080 }
    ],
    controls: {
        'control-001': {
            description: 'Test control',
            requirements: [{ 'control-requirement-url': 'https://example.com/requirement', 'control-config-url': 'https://example.com/config' }]
        }
    },
    metadata: [{ key: 'value' }],
    'data-classification': 'Public',
    'run-as': 'admin',
};


describe('CalmNodeDetails', () => {
    it('should create a CalmNodeDetails instance from JSON data', () => {
        const nodeDetails = CalmNodeDetails.fromJson(nodeData.details);

        expect(nodeDetails).toBeInstanceOf(CalmNodeDetails);
        expect(nodeDetails.detailedArchitecture).toBe('https://example.com/architecture');
        expect(nodeDetails.requiredPattern).toBe('https://example.com/pattern');
    });
});

describe('CalmNode', () => {
    it('should create a CalmNode instance from JSON data', () => {
        const node = CalmNode.fromJson(nodeData);

        expect(node).toBeInstanceOf(CalmNode);
        expect(node.uniqueId).toBe('node-001');
        expect(node.nodeType).toBe('system');
        expect(node.name).toBe('Test Node');
        expect(node.description).toBe('This is a test node');
        expect(node.details).toBeInstanceOf(CalmNodeDetails);
        expect(node.details.detailedArchitecture).toBe('https://example.com/architecture');
        expect(node.details.requiredPattern).toBe('https://example.com/pattern');
        expect(node.interfaces).toHaveLength(2);
        expect(node.controls).toHaveLength(1);
        expect(node.controls[0].controlId).toBe('control-001');
        expect(node.metadata).toEqual({ data: { key: 'value' } });
        expect(node.dataClassification).toBe('Public');
        expect(node.runAs).toBe('admin');
    });

    it('should handle optional fields in CalmNode', () => {
        const nodeDataWithoutOptionalFields: CalmNodeSchema = {
            'unique-id': 'node-002',
            'node-type': 'service',
            name: 'Another Test Node',
            description: 'Another test node description',
            details: {
                'detailed-architecture': 'https://example.com/architecture-2',
                'required-pattern': 'https://example.com/pattern-2'
            },
            interfaces: [{ 'unique-id': 'interface-002', port: 8080 }],
            controls: { 'control-002': { description: 'Another test control', requirements: [{ 'control-requirement-url': 'https://example.com/requirement2', 'control-config-url': 'https://example.com/config2' }] } },
            metadata: [{ key: 'value' }]
        };

        const nodeWithoutOptionalFields = CalmNode.fromJson(nodeDataWithoutOptionalFields);

        expect(nodeWithoutOptionalFields).toBeInstanceOf(CalmNode);
        expect(nodeWithoutOptionalFields.uniqueId).toBe('node-002');
        expect(nodeWithoutOptionalFields.runAs).toBeUndefined();
    });

    it('should handle empty interfaces, controls, and metadata', () => {
        const nodeDataWithEmptyFields: CalmNodeSchema = {
            'unique-id': 'node-003',
            'node-type': 'database',
            name: 'Database Node',
            description: 'Node with empty fields',
            details: {
                'detailed-architecture': 'https://example.com/architecture-3',
                'required-pattern': 'https://example.com/pattern-3'
            },
            interfaces: [],
            controls: {},
            metadata: []
        };

        const nodeWithEmptyFields = CalmNode.fromJson(nodeDataWithEmptyFields);

        expect(nodeWithEmptyFields).toBeInstanceOf(CalmNode);
        expect(nodeWithEmptyFields.interfaces).toHaveLength(0);
        expect(nodeWithEmptyFields.controls).toHaveLength(0);
        expect(nodeWithEmptyFields.metadata).toEqual({ data: {}});
    });
});
