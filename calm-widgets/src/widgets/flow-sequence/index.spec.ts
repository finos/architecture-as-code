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

    it('resolves source/target for composed-of relationships from the container/nodes pair', () => {
        const arch = makeArch();
        arch.relationships.push({
            'unique-id': 'rel-composed',
            'relationship-type': { 'composed-of': { container: 'system-z', nodes: ['service-x'] } },
        });
        arch.flows![0].transitions.push({
            'relationship-unique-id': 'rel-composed',
            'sequence-number': 4,
            description: 'composed-of edge',
        });

        const vm = FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' });
        const composedTransition = vm.transitions.find((t) => t.relationshipId === 'rel-composed')!;
        expect(composedTransition.source).toBe('System Z');
        expect(composedTransition.target).toBe('Service X');
    });

    it('falls back to "unknown" when the relationship cannot be located', () => {
        const arch = makeArch();
        arch.flows![0].transitions.push({
            'relationship-unique-id': 'rel-missing',
            'sequence-number': 99,
            description: 'dangling',
        });

        const vm = FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' });
        const dangling = vm.transitions.find((t) => t.relationshipId === 'rel-missing')!;
        expect(dangling.source).toBe('unknown');
        expect(dangling.target).toBe('unknown');
    });

    it('falls back to "unknown" when the relationship has no relationship-type', () => {
        const arch = makeArch();
        arch.relationships.push({
            'unique-id': 'rel-no-type',
        } as never);
        arch.flows![0].transitions.push({
            'relationship-unique-id': 'rel-no-type',
            'sequence-number': 99,
            description: 'no type',
        });

        const vm = FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' });
        const noType = vm.transitions.find((t) => t.relationshipId === 'rel-no-type')!;
        expect(noType.source).toBe('unknown');
        expect(noType.target).toBe('unknown');
    });

    it('falls back to "unknown" for relationship kinds the widget does not render (options)', () => {
        const arch = makeArch();
        arch.relationships.push({
            'unique-id': 'rel-options',
            'relationship-type': {
                options: [{ description: 'an option', nodes: ['service-x'], relationships: [] }],
            },
        });
        arch.flows![0].transitions.push({
            'relationship-unique-id': 'rel-options',
            'sequence-number': 99,
            description: 'options edge',
        });

        const vm = FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' });
        const optionsTransition = vm.transitions.find((t) => t.relationshipId === 'rel-options')!;
        expect(optionsTransition.source).toBe('unknown');
        expect(optionsTransition.target).toBe('unknown');
    });

    it('falls back to the raw id when a referenced node is missing from architecture.nodes', () => {
        const arch = makeArch();
        arch.relationships.push({
            'unique-id': 'rel-ghost',
            'relationship-type': {
                connects: { source: { node: 'ghost-a' }, destination: { node: 'ghost-b' } },
            },
        });
        arch.flows![0].transitions.push({
            'relationship-unique-id': 'rel-ghost',
            'sequence-number': 99,
            description: 'ghost edge',
        });

        const vm = FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' });
        const ghost = vm.transitions.find((t) => t.relationshipId === 'rel-ghost')!;
        expect(ghost.source).toBe('ghost-a');
        expect(ghost.target).toBe('ghost-b');
    });

    it('rejects contexts that are not objects or lack a flows array', () => {
        expect(FlowSequenceWidget.validateContext!(null, { 'flow-id': 'flow-demo' })).toBe(false);
        expect(FlowSequenceWidget.validateContext!({ flows: 'not-an-array' }, { 'flow-id': 'flow-demo' })).toBe(false);
        expect(FlowSequenceWidget.validateContext!({ nodes: [] }, { 'flow-id': 'flow-demo' })).toBe(false);
    });

    it('rejects when options omit flow-id', () => {
        const arch = makeArch();
        expect(FlowSequenceWidget.validateContext!(arch)).toBe(false);
        expect(FlowSequenceWidget.validateContext!(arch, {} as never)).toBe(false);
    });

    it('throws when architecture.flows is not an array', () => {
        const arch = { ...makeArch(), flows: undefined as never };
        expect(() => FlowSequenceWidget.transformToViewModel!(arch, { 'flow-id': 'flow-demo' })).toThrow(
            /architecture.flows is missing or not an array/i
        );
    });
});
