import { describe, it, expect } from 'vitest';
import { FlowFocusStrategy } from './flow-focus-strategy';
import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
    CalmFlowCanonicalModel,
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

const baseOpts = (): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    renderNodeTypeShapes: false,
    edgeLabels: 'description',
    collapseRelationships: false,
});

function relConnects(id: string, srcNode: string, dstNode: string): CalmRelationshipCanonicalModel {
    return {
        'unique-id': id,
        'relationship-type': {
            connects: {
                source: { node: srcNode, interfaces: ['api'] },
                destination: { node: dstNode, interfaces: ['jdbc'] },
            },
        },
    };
}

const model: CalmCoreCanonicalModel = {
    nodes: [
        { 'unique-id': 'n1', 'node-type': 'service', name: 'n1', description: '', interfaces: [{ 'unique-id': 'api' }] },
        { 'unique-id': 'n2', 'node-type': 'database', name: 'n2', description: '', interfaces: [{ 'unique-id': 'jdbc' }] },
        { 'unique-id': 'n3', 'node-type': 'service', name: 'n3', description: '' },
    ],
    relationships: [
        relConnects('r1', 'n1', 'n2'),
        relConnects('r2', 'n3', 'n2'),
    ],
    flows: [
        {
            'unique-id': 'f-choose',
            name: 'Payment Flow',
            description: '',
            'requirement-url': 'req://x',
            transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' }],
        } as CalmFlowCanonicalModel,
    ],
};

describe('FlowFocusStrategy', () => {
    it('no focusFlows → passes through nodes but activates all relationships', () => {
        const strat = new FlowFocusStrategy();
        const res = strat.applyFilter(model, baseOpts(), new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']);

        // visibleNodes unchanged (no seeds added)
        expect(res.visibleNodes.size).toBe(0);
        expect(res.warnings).toEqual([]);
    });

    it('valid flow id filters relationships and adds endpoints as seeds/visible', () => {
        const strat = new FlowFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusFlows: ['f-choose'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1']);

        expect(res.seedNodes).toEqual(new Set(['n1', 'n2']));
        expect(res.visibleNodes).toEqual(new Set(['n1', 'n2']));
    });

    it('invalid flow focus → activates all relationships, warns, and adds no nodes', () => {
        const strat = new FlowFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusFlows: ['nope'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']); // pass-through

        // no seed nodes when nothing matched
        expect(res.seedNodes).toBeUndefined();

        // visibleNodes unchanged (we passed empty)
        expect(res.visibleNodes.size).toBe(0);

        // warning present: "No flows matched: ..."
        expect(res.warnings.length).toBeGreaterThan(0);
    });
});
