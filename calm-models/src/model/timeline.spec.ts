import { CalmTimelineSchema } from '../types';
import { CalmTimeline } from './timeline.js';
import { CalmCore } from './core.js';
import { ResolvableAndAdaptable } from './resolvable';

describe('CalmTimeline', () => {
    it('should create from minimal schema', () => {
        const minimalSchema: CalmTimelineSchema = {
            moments: []
        };
        const core = CalmTimeline.fromSchema(minimalSchema);
        expect(core).toBeInstanceOf(CalmTimeline);
        expect(core.moments).toEqual([]);
        expect(core.metadata).toBeUndefined();
        expect(core.currentMoment).toBeUndefined();
    });

    it('should create from single moment', () => {
        const schema: CalmTimelineSchema = {
            moments: [
                {
                    'unique-id': 'v1',
                    'name': 'Moment 1',
                    'description': 'First architectural moment',
                    'node-type': 'moment',
                    'details': {
                        'detailed-architecture': 'my-arch.json'
                    }
                }
            ],
            'current-moment': 'v1'
        };
        const core = CalmTimeline.fromSchema(schema);
        expect(core.moments.length).toBe(1);
        expect(core.currentMoment).toBe('v1');
        expect(core.moments[0].name).toBe('Moment 1');
    });

    it('should produce the correct canonical model (minimal)', () => {
        const minimalSchema: CalmTimelineSchema = {
            moments: []
        };
        const core = CalmTimeline.fromSchema(minimalSchema);
        expect(core.toCanonicalSchema()).toEqual({
            moments: [],
            metadata: undefined,
            'current-moment': undefined
        });
    });

    it('should produce the correct canonical model (full, realistic)', () => {
        const schema: CalmTimelineSchema = {
            moments: [
                {
                    'unique-id': 'v1',
                    'name': 'Moment 1',
                    'description': 'First architectural moment',
                    'node-type': 'moment',
                    'details': {
                        'detailed-architecture': 'my-arch.json'
                    }
                },
                {
                    'unique-id': 'v2',
                    'name': 'Moment 2',
                    'description': 'Second architectural moment',
                    'node-type': 'moment',
                    'details': {
                        'detailed-architecture': 'my-arch-v2.json'
                    }
                }
            ],
            'current-moment': 'v1',
            metadata: [
                {
                    'environment': 'test'
                }
            ]
        };
        const core = CalmTimeline.fromSchema(schema);
        const canonical = core.toCanonicalSchema();
        expect(canonical.moments[0]['unique-id']).toBe('v1');
        expect(canonical.metadata).toBeDefined();
        expect(canonical["current-moment"]).toEqual('v1');
    });

    it('should return the original schema with toSchema()', () => {
        const schema: CalmTimelineSchema = {
            moments: [
                {
                    'unique-id': 'v1',
                    'name': 'First Moment',
                    'description': 'The first architectural moment',
                    'node-type': 'moment',
                    'details': {
                        'detailed-architecture': 'arch-v1.json'
                    }
                }
            ]
        };
        const timeline = CalmTimeline.fromSchema(schema);
        expect(timeline.toSchema()).toEqual(schema);
        expect(timeline.moments[0].toSchema()).toEqual(schema.moments[0]);
    });

    it('should support nested CalmCore in moment details', () => {
        const schema: CalmTimelineSchema = {
            moments: [
                {
                    'unique-id': 'v1',
                    'name': 'Moment 1',
                    'description': 'First architectural moment',
                    'node-type': 'moment',
                    'details': {
                        'detailed-architecture': 'arch'
                    }
                }
            ]
        };
        const timeline = CalmTimeline.fromSchema(schema);
        // Simulate resolved detailedArchitecture with an inner CalmCore
        const moment = timeline.moments[0];
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
        const { details } = moment.toCanonicalSchema();
        expect(JSON.parse(JSON.stringify(details))).toEqual({
            nodes: [
                {
                    'unique-id': 'inner-node',
                    'node-type': 'service',
                    'name': 'Inner',
                    'description': 'Inner node'
                }
            ],
            relationships: []
        });
    });

    it('should collapse details if detailed-architecture is resolved', () => {
        const schema: CalmTimelineSchema = {
            moments: [
                {
                    'unique-id': 'v1',
                    'name': 'Moment 1',
                    'description': 'First architectural moment',
                    'node-type': 'moment',
                    'details': {
                        'detailed-architecture': 'arch'
                    }
                }
            ]
        };
        const timeline = CalmTimeline.fromSchema(schema);
        // Simulate resolved detailedArchitecture with an inner CalmCore
        const moment = timeline.moments[0];
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
        expect(moment.toCanonicalSchema().details).toEqual({
            nodes: [
                { 'unique-id': 'inner-node', 'node-type': 'service', 'name': 'Inner', 'description': 'Inner node' }
            ],
            relationships: []
        });
    });
});
