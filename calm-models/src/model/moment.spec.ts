import { CalmNodeDetails } from './node.js';
import { CalmMomentSchema } from '../types';
import { ResolvableAndAdaptable } from './resolvable';
import { CalmMoment } from "./moment";
import { CalmCore } from './core.js';

describe('CalmMoment', () => {
    const minimalSchema: CalmMomentSchema = {
        'unique-id': 'moment-1',
        'node-type': 'moment',
        name: 'Moment 1',
        description: 'A minimal moment',
        details: {
            'detailed-architecture': 'arch-1'
        }
    };

    it('should create from minimal schema', () => {
        const moment = CalmMoment.fromSchema(minimalSchema);
        expect(moment).toBeInstanceOf(CalmMoment);
        expect(moment.uniqueId).toBe('moment-1');
        expect(moment.nodeType).toBe('moment');
        expect(moment.name).toBe('Moment 1');
        expect(moment.description).toBe('A minimal moment');
        expect(moment.details.detailedArchitecture).toBeDefined();
        expect(moment.interfaces).toBeUndefined();
        expect(moment.controls).toBeUndefined();
        expect(moment.metadata).toBeUndefined();
        expect(moment.additionalProperties).toBeUndefined();
    });

    it('should create from schema with all fields', () => {
        const schema: CalmMomentSchema = {
            'unique-id': 'moment-2',
            'node-type': 'moment',
            name: 'Moment 2',
            description: 'A full moment',
            details: {
                'required-pattern': 'pattern-x',
                'detailed-architecture': 'arch-x'
            },
            controls: {
                review: {
                    description: 'desc',
                    requirements: [
                        { 'requirement-url': 'url', 'config-url': 'cfg' }
                    ]
                }
            },
            metadata: [{ foo: 'bar' }],
            adrs: ['adr-1', 'adr-2'],
            extra: 'extra-value'
        };
        const moment = CalmMoment.fromSchema(schema);
        expect(moment.details).toBeInstanceOf(CalmNodeDetails);
        expect(moment.controls).toBeDefined();
        expect(moment.metadata).toBeDefined();
        expect(moment.adrs).toBeDefined();
        expect(moment.additionalProperties?.extra).toBe('extra-value');
    });

    it('should produce the correct canonical model (minimal)', () => {
        const moment = CalmMoment.fromSchema(minimalSchema);
        console.log(moment);
        expect(moment.toCanonicalSchema()).toEqual({
            'unique-id': 'moment-1',
            'node-type': 'moment',
            name: 'Moment 1',
            description: 'A minimal moment',
            details: undefined,
            interfaces: undefined,
            controls: undefined,
            metadata: undefined,
            additionalProperties: undefined,
            'valid-from': undefined,
            adrs: undefined
        });
    });

    it('should produce the correct canonical model (all fields, unresolved details)', () => {
        const schema: CalmMomentSchema = {
            'unique-id': 'node-3',
            'node-type': 'moment',
            name: 'Node 3',
            description: 'Node with details',
            details: {
                'required-pattern': 'pattern-y',
                'detailed-architecture': 'arch-y'
            },
            controls: {
                review: {
                    description: 'desc',
                    requirements: [
                        { 'requirement-url': 'url', 'config-url': 'cfg' }
                    ]
                }
            },
            metadata: [{ foo: 'baz' }],
            extra: 'extra-x'
        };
        const moment = CalmMoment.fromSchema(schema);
        expect(moment.toCanonicalSchema()).toEqual({
            'unique-id': 'node-3',
            'node-type': 'moment',
            name: 'Node 3',
            description: 'Node with details',
            details: undefined,
            interfaces: undefined,
            controls: moment.controls?.toCanonicalSchema(),
            metadata: moment.metadata?.toCanonicalSchema(),
            additionalProperties: { extra: 'extra-x' }
        });
    });

    it('should include canonicalized details if detailedArchitecture is resolved', () => {
        const schema: CalmMomentSchema = {
            'unique-id': 'node-4',
            'node-type': 'moment',
            name: 'Node 4',
            description: 'Node with resolved details',
            details: {
                'required-pattern': 'pattern-z',
                'detailed-architecture': 'arch-z'
            }
        };
        const moment = CalmMoment.fromSchema(schema);
        // Fake resolved detailedArchitecture
        if (moment.details && moment.details.detailedArchitecture) {
            moment.details.detailedArchitecture = new ResolvableAndAdaptable(
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
            'node-type': 'moment',
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

        expect(JSON.stringify(moment.toCanonicalSchema())).toEqual(JSON.stringify(expected));
    });

    it('should support nested detailed-architecture resolved to an inner CalmCore', () => {
        const schema: CalmMomentSchema = {
            'unique-id': 'node-nested',
            'node-type': 'moment',
            name: 'Node Nested',
            description: 'Moment with nested architecture',
            details: {
                'required-pattern': 'pattern-nested',
                'detailed-architecture': 'arch-nested'
            }
        };
        const moment = CalmMoment.fromSchema(schema);
        // Simulate resolved detailedArchitecture with an inner CalmCore
        if (moment.details && moment.details.detailedArchitecture) {
            moment.details.detailedArchitecture = new ResolvableAndAdaptable(
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
        const canonical = JSON.parse(JSON.stringify(moment.toCanonicalSchema()));
        expect(canonical).toEqual({
            'unique-id': 'node-nested',
            'node-type': 'moment',
            name: 'Node Nested',
            description: 'Moment with nested architecture',
            details: {
                nodes: [
                    { 'unique-id': 'inner-node', 'node-type': 'service', name: 'Inner', description: 'Inner node' }
                ],
                relationships: []
            }
        });
    });

    it('should return the original schema with toSchema()', () => {
        const moment = CalmMoment.fromSchema(minimalSchema);
        expect(moment.toSchema()).toEqual(minimalSchema);
    });

    it('should handle missing controls, metadata', () => {
        const schema: CalmMomentSchema = {
            'unique-id': 'node-6',
            'node-type': 'moment',
            name: 'Node 6',
            description: 'Moment with missing optionals',
            details: {
                'detailed-architecture': 'arch-6'
            }
        };
        const moment = CalmMoment.fromSchema(schema);
        expect(moment.interfaces).toBeUndefined();
        expect(moment.controls).toBeUndefined();
        expect(moment.metadata).toBeUndefined();
        expect(moment.toCanonicalSchema().controls).toBeUndefined();
    });

    it('should include additional properties in canonical model', () => {
        const schema: CalmMomentSchema = {
            'unique-id': 'node-7',
            'node-type': 'moment',
            name: 'Node 7',
            description: 'Node with additional',
            details: {
                'detailed-architecture': 'arch-7'
            },
            foo: 'bar',
            bar: 42
        };
        const moment = CalmMoment.fromSchema(schema);
        expect(moment.additionalProperties).toEqual({ foo: 'bar', bar: 42 });
        expect(moment.toCanonicalSchema().additionalProperties).toEqual({ foo: 'bar', bar: 42 });
    });
});
