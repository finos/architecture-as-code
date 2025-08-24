import { CalmNode, CalmNodeDetails } from './node.js';
import {CalmNodeSchema, CalmNodeDetailsSchema} from '../types/core-types.js';
import {ResolvableAndAdaptable} from './resolvable';
import {CalmCore} from './core';

describe('CalmNodeDetails', () => {
    it('should create from schema with both fields', () => {
        const schema: CalmNodeDetailsSchema = {
            'required-pattern': 'pattern-1',
            'detailed-architecture': 'arch-1'
        };
        const details = CalmNodeDetails.fromSchema(schema);
        expect(details).toBeInstanceOf(CalmNodeDetails);
        expect(details.requiredPattern?.reference).toBe('pattern-1');
        expect(details.detailedArchitecture?.reference).toBe('arch-1');
    });

    it('should create from schema with only required-pattern', () => {
        const schema: CalmNodeDetailsSchema = {
            'required-pattern': 'pattern-2'
        };
        const details = CalmNodeDetails.fromSchema(schema);
        expect(details.requiredPattern?.reference).toBe('pattern-2');
        expect(details.detailedArchitecture).toBeUndefined();
    });

    it('should create from schema with only detailed-architecture', () => {
        const schema: CalmNodeDetailsSchema = {
            'detailed-architecture': 'arch-2'
        };
        const details = CalmNodeDetails.fromSchema(schema);
        expect(details.requiredPattern).toBeUndefined();
        expect(details.detailedArchitecture?.reference).toBe('arch-2');
    });

    it('should return the original schema with toSchema()', () => {
        const schema: CalmNodeDetailsSchema = {
            'required-pattern': 'pattern-3',
            'detailed-architecture': 'arch-3'
        };
        const details = CalmNodeDetails.fromSchema(schema);
        expect(details.toSchema()).toEqual(schema);
    });

    it('should throw on toCanonicalSchema()', () => {
        const schema: CalmNodeDetailsSchema = {
            'required-pattern': 'pattern-4'
        };
        const details = CalmNodeDetails.fromSchema(schema);
        expect(() => details.toCanonicalSchema()).toThrow();
    });
});

describe('CalmNode', () => {
    const minimalSchema: CalmNodeSchema = {
        'unique-id': 'node-1',
        'node-type': 'service',
        name: 'Node 1',
        description: 'A minimal node'
    };

    it('should create from minimal schema', () => {
        const node = CalmNode.fromSchema(minimalSchema);
        expect(node).toBeInstanceOf(CalmNode);
        expect(node.uniqueId).toBe('node-1');
        expect(node.nodeType).toBe('service');
        expect(node.name).toBe('Node 1');
        expect(node.description).toBe('A minimal node');
        expect(node.details).toBeUndefined();
        expect(node.interfaces).toBeUndefined();
        expect(node.controls).toBeUndefined();
        expect(node.metadata).toBeUndefined();
        expect(node.additionalProperties).toBeUndefined();
    });

    it('should create from schema with all fields', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-2',
            'node-type': 'database',
            name: 'Node 2',
            description: 'A full node',
            details: {
                'required-pattern': 'pattern-x',
                'detailed-architecture': 'arch-x'
            },
            interfaces: [
                { 'unique-id': 'iface-1', 'definition-url': 'url', config: {} }
            ],
            controls: {
                security: {
                    description: 'desc',
                    requirements: [
                        { 'requirement-url': 'url', 'config-url': 'cfg' }
                    ]
                }
            },
            metadata: [{ foo: 'bar' }],
            extra: 'extra-value'
        };
        const node = CalmNode.fromSchema(schema);
        expect(node.details).toBeInstanceOf(CalmNodeDetails);
        expect(node.interfaces?.[0].uniqueId).toBe('iface-1');
        expect(node.controls).toBeDefined();
        expect(node.metadata).toBeDefined();
        expect(node.additionalProperties?.extra).toBe('extra-value');
    });

    it('should produce the correct canonical model (minimal)', () => {
        const node = CalmNode.fromSchema(minimalSchema);
        expect(node.toCanonicalSchema()).toEqual({
            'unique-id': 'node-1',
            'node-type': 'service',
            name: 'Node 1',
            description: 'A minimal node',
            details: undefined,
            interfaces: undefined,
            controls: undefined,
            metadata: undefined,
            additionalProperties: undefined
        });
    });

    it('should produce the correct canonical model (all fields, unresolved details)', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-3',
            'node-type': 'system',
            name: 'Node 3',
            description: 'Node with details',
            details: {
                'required-pattern': 'pattern-y',
                'detailed-architecture': 'arch-y'
            },
            interfaces: [
                { 'unique-id': 'iface-2', 'definition-url': 'url', config: {} }
            ],
            controls: {
                security: {
                    description: 'desc',
                    requirements: [
                        { 'requirement-url': 'url', 'config-url': 'cfg' }
                    ]
                }
            },
            metadata: [{ foo: 'baz' }],
            extra: 'extra-x'
        };
        const node = CalmNode.fromSchema(schema);
        expect(node.toCanonicalSchema()).toEqual({
            'unique-id': 'node-3',
            'node-type': 'system',
            name: 'Node 3',
            description: 'Node with details',
            details: undefined,
            interfaces: node.interfaces?.map(i => i.toCanonicalSchema()),
            controls: node.controls?.toCanonicalSchema(),
            metadata: node.metadata?.toCanonicalSchema(),
            additionalProperties: { extra: 'extra-x' }
        });
    });

    it('should include canonicalized details if detailedArchitecture is resolved', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-4',
            'node-type': 'system',
            name: 'Node 4',
            description: 'Node with resolved details',
            details: {
                'required-pattern': 'pattern-z',
                'detailed-architecture': 'arch-z'
            }
        };
        const node = CalmNode.fromSchema(schema);
        // Fake resolved detailedArchitecture
        if (node.details && node.details.detailedArchitecture) {
            node.details.detailedArchitecture = new ResolvableAndAdaptable(
                'fake-url',
                CalmCore.fromSchema,
                CalmCore.fromSchema({
                    nodes: [
                        { 'unique-id': 'inner-node', 'node-type': 'service', 'name': 'Inner', 'description': 'Inner node' }
                    ],
                    relationships: []
                })
            );
        }
        const expected = {
            'unique-id': 'node-4',
            'node-type': 'system',
            name: 'Node 4',
            description: 'Node with resolved details',
            details: {
                nodes: [
                    {
                        'unique-id': 'inner-node',
                        'node-type': 'service',
                        name: 'Inner',
                        description: 'Inner node'
                    }
                ],
                relationships: []
            }
        };

        expect(JSON.stringify(node.toCanonicalSchema())).toEqual(JSON.stringify(expected));


        // stringify both sides to avoid issues with undefined properties
        expect(JSON.stringify(node.toCanonicalSchema())).toEqual(JSON.stringify(expected));

    });

    it('should support nested detailed-architecture resolved to an inner CalmCore', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-nested',
            'node-type': 'system',
            name: 'Node Nested',
            description: 'Node with nested architecture',
            details: {
                'required-pattern': 'pattern-nested',
                'detailed-architecture': 'arch-nested'
            }
        };
        const node = CalmNode.fromSchema(schema);
        // Simulate resolved detailedArchitecture with an inner CalmCore
        if (node.details && node.details.detailedArchitecture) {
            node.details.detailedArchitecture = new ResolvableAndAdaptable(
                'fake-url',
                CalmCore.fromSchema,
                CalmCore.fromSchema({
                    nodes: [
                        { 'unique-id': 'inner-node', 'node-type': 'service', 'name': 'Inner', 'description': 'Inner node' }
                    ],
                    relationships: []
                })
            );
        }
        const canonical = JSON.parse(JSON.stringify(node.toCanonicalSchema()));
        expect(canonical).toEqual({
            'unique-id': 'node-nested',
            'node-type': 'system',
            name: 'Node Nested',
            description: 'Node with nested architecture',
            details: {
                nodes: [
                    { 'unique-id': 'inner-node', 'node-type': 'service', name: 'Inner', description: 'Inner node' }
                ],
                relationships: []
            }
        });

    });

    it('should return the original schema with toSchema()', () => {
        const node = CalmNode.fromSchema(minimalSchema);
        expect(node.toSchema()).toEqual(minimalSchema);
    });

    it('should handle empty interfaces array', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-5',
            'node-type': 'service',
            name: 'Node 5',
            description: 'Node with empty interfaces',
            interfaces: []
        };
        const node = CalmNode.fromSchema(schema);
        expect(node.interfaces).toEqual([]);
        expect(node.toCanonicalSchema().interfaces).toEqual([]);
    });

    it('should handle missing interfaces, controls, metadata, details', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-6',
            'node-type': 'service',
            name: 'Node 6',
            description: 'Node with missing optionals'
        };
        const node = CalmNode.fromSchema(schema);
        expect(node.interfaces).toBeUndefined();
        expect(node.controls).toBeUndefined();
        expect(node.metadata).toBeUndefined();
        expect(node.details).toBeUndefined();
        expect(node.toCanonicalSchema().interfaces).toBeUndefined();
    });

    it('should include additional properties in canonical model', () => {
        const schema: CalmNodeSchema = {
            'unique-id': 'node-7',
            'node-type': 'service',
            name: 'Node 7',
            description: 'Node with additional',
            foo: 'bar',
            bar: 42
        };
        const node = CalmNode.fromSchema(schema);
        expect(node.additionalProperties).toEqual({ foo: 'bar', bar: 42 });
        expect(node.toCanonicalSchema().additionalProperties).toEqual({ foo: 'bar', bar: 42 });
    });
});
