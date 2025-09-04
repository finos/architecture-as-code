import { describe, it, expect } from 'vitest';
import { FlowSequenceWidget } from './index';
import {
    CalmCoreCanonicalModel,
} from '@finos/calm-models/canonical';

const makeArch = (): CalmCoreCanonicalModel => ({
    nodes: [
        { 'unique-id': 'actor-a', 'node-type': 'actor', name: 'Actor A', description: 'actor' },
        { 'unique-id': 'service-x', 'node-type': 'service', name: 'Service X', description: 'service' },
        { 'unique-id': 'service-y', 'node-type': 'service', name: 'Service Y', description: 'service' },
        { 'unique-id': 'system-z', 'node-type': 'system', name: 'System Z', description: 'system' },
    ],
    relationships: [
        {
            'unique-id': 'rel-1',
            'relationship-type': { interacts: { actor: 'actor-a', nodes: ['service-x'] } },
        },
        {
            'unique-id': 'rel-2',
            'relationship-type': {
                connects: { source: { node: 'service-x' }, destination: { node: 'service-y' } },
            },
        },
        {
            'unique-id': 'rel-3',
            'relationship-type': { 'deployed-in': { container: 'system-z', nodes: ['service-y'] } },
        },
    ],
    flows: [
        {
            'unique-id': 'flow-demo',
            name: 'Demo Flow',
            description: 'Actor → Services → System',
            'requirement-url': '',
            transitions: [
                {
                    'relationship-unique-id': 'rel-1',
                    'sequence-number': 1,
                    description: 'Actor interacts with first service',
                    direction: 'source-to-destination',
                },
                {
                    'relationship-unique-id': 'rel-2',
                    'sequence-number': 2,
                    description: 'First service connects to second service',
                },
                {
                    'relationship-unique-id': 'rel-3',
                    'sequence-number': 3,
                    description: 'Second service is deployed in system',
                    direction: 'destination-to-source',
                },
            ],
        },
    ]
});

describe('FlowSequenceWidget (actor → services → system)', () => {
    it('accepts only contexts that contain the target flow', () => {
        const arch = makeArch();
        expect(FlowSequenceWidget.validateContext!(arch, { 'flow-id': 'flow-demo' })).toBe(true);
        expect(FlowSequenceWidget.validateContext!(arch, { 'flow-id': 'does-not-exist' })).toBe(false);

        const noFlows: CalmCoreCanonicalModel = { ...arch, flows: [], nodes: [], relationships: [] };
        expect(FlowSequenceWidget.validateContext!(noFlows, { 'flow-id': 'flow-demo' })).toBe(false);
    });

    it('builds a sequence from actor to services to system with defaulted direction', () => {
        const arch = makeArch();
        const vm = FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' });

        expect(vm).toEqual({
            transitions: [
                {
                    relationshipId: 'rel-1',
                    source: 'Actor A',
                    target: 'Service X',
                    description: 'Actor interacts with first service',
                    direction: 'source-to-destination',
                },
                {
                    relationshipId: 'rel-2',
                    source: 'Service X',
                    target: 'Service Y',
                    description: 'First service connects to second service',
                    direction: 'source-to-destination', // default applied by widget
                },
                {
                    relationshipId: 'rel-3',
                    source: 'System Z',
                    target: 'Service Y',
                    description: 'Second service is deployed in system',
                    direction: 'destination-to-source',
                },
            ],
        });
    });

    it('reports clearly when flow-id is missing', () => {
        const arch = makeArch();
        expect(() => FlowSequenceWidget.transformToViewModel!(arch, {} as never)).toThrow(/flow-id option is required/i);
    });

    it('reports clearly when the flow cannot be found', () => {
        const arch = makeArch();
        expect(() => FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'does-not-exist' })).toThrow(/Flow with unique-id 'does-not-exist' not found in architecture.flows/i);
    });


});
