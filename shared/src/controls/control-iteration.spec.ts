import { describe, it, expect } from 'vitest';
import { iterateControls } from './control-iteration.js';
import { CalmCore } from '@finos/calm-models/model';
import { CalmCoreSchema } from '@finos/calm-models/types';

const control = (desc: string) => ({
    description: desc,
    requirements: [{ 'requirement-url': 'https://calm.example.com/req.json', config: {} }]
});

const arch: CalmCoreSchema = {
    '$schema': 'https://calm.finos.org/release/1.2/meta/calm.json',
    'unique-id': 'arch',
    controls: { 'top-level': control('top') },
    nodes: [
        { 'unique-id': 'node-1', 'node-type': 'system', name: 'n1', description: 'd', controls: { 'node-ctrl': control('node') } }
    ],
    relationships: [
        {
            'unique-id': 'rel-1',
            'relationship-type': { connects: { source: { node: 'node-1' }, destination: { node: 'node-1' } } },
            controls: { 'rel-ctrl': control('rel') }
        }
    ],
    flows: [
        { 'unique-id': 'flow-1', name: 'f', description: 'flow', transitions: [], controls: { 'flow-ctrl': control('flow') } }
    ]
} as unknown as CalmCoreSchema;

describe('iterateControls', () => {
    it('enumerates controls across all scopes in document order', () => {
        const core = CalmCore.fromSchema(arch);
        const locations = [...iterateControls(core)];

        expect(locations.map(l => ({ scope: l.scope, pathPrefix: l.pathPrefix, appliedTo: l.appliedTo, controlId: l.controlId }))).toEqual([
            { scope: 'Architecture', pathPrefix: '/controls', appliedTo: '', controlId: 'top-level' },
            { scope: 'Node', pathPrefix: '/nodes/0/controls', appliedTo: 'node-1', controlId: 'node-ctrl' },
            { scope: 'Relationship', pathPrefix: '/relationships/0/controls', appliedTo: 'rel-1', controlId: 'rel-ctrl' },
            { scope: 'Flow', pathPrefix: '/flows/0/controls', appliedTo: 'flow-1', controlId: 'flow-ctrl' }
        ]);
    });

    it('yields nothing for an architecture with no controls', () => {
        const bare = CalmCore.fromSchema({
            '$schema': 'https://calm.finos.org/release/1.2/meta/calm.json',
            'unique-id': 'bare',
            nodes: [],
            relationships: []
        } as unknown as CalmCoreSchema);
        expect([...iterateControls(bare)]).toHaveLength(0);
    });
});
