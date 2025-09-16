import { describe, it, expect } from 'vitest';
import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
    CalmFlowCanonicalModel,
    CalmControlCanonicalModel,
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';
import { ControlFocusStrategy } from './control-focus-strategy';

const baseOpts = (): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    edgeLabels: 'description',
});

const ctrl = (description = 'control'): CalmControlCanonicalModel => ({
    description,
    requirements: [{ 'requirement-url': 'req://x' }],
});

function relConnects(
    id: string,
    srcNode: string,
    dstNode: string,
    controlIds?: string[],
): CalmRelationshipCanonicalModel {
    const base: CalmRelationshipCanonicalModel = {
        'unique-id': id,
        'relationship-type': {
            connects: {
                source: { node: srcNode, interfaces: ['api'] },
                destination: { node: dstNode, interfaces: ['jdbc'] },
            },
        },
    };
    if (controlIds && controlIds.length) {
        const controls = Object.fromEntries(controlIds.map(c => [c, ctrl()]));
        return { ...base, controls };
    }
    return base;
}

const baseModel: CalmCoreCanonicalModel = {
    nodes: [
        {
            'unique-id': 'svcA',
            'node-type': 'service',
            name: 'svcA',
            description: '',
            interfaces: [{ 'unique-id': 'api' }],
            controls: { C1: ctrl('node C1'), C2: ctrl('node C2') },
        },
        {
            'unique-id': 'dbB',
            'node-type': 'database',
            name: 'dbB',
            description: '',
            interfaces: [{ 'unique-id': 'jdbc' }],
            controls: { C2: ctrl('node C2 on dbB') },
        },
        { 'unique-id': 'svcC', 'node-type': 'service', name: 'svcC', description: '' },
    ],
    relationships: [
        relConnects('r1', 'svcA', 'dbB', ['C1']),
        relConnects('r2', 'svcC', 'dbB', ['C3']),
    ],
};

describe('ControlFocusStrategy', () => {
    it('no focusControls → pass-through relationships and unchanged visible nodes', () => {
        const strat = new ControlFocusStrategy();
        const res = strat.applyFilter(baseModel, baseOpts(), new Set(['svcA']), baseModel.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']); // all relationships passed through

        expect(res.visibleNodes).toEqual(new Set(['svcA']));
        expect(res.seedNodes).toBeUndefined();
        expect(res.warnings).toEqual([]);
    });

    it('flow-level controls: matches flow controls → only that flow’s transitions active; endpoints added', () => {
        // Clone model, add a flow that carries C3 (which appears on r2)
        const model: CalmCoreCanonicalModel = {
            ...baseModel,
            flows: [
                {
                    'unique-id': 'flowX',
                    name: 'Flow X',
                    description: '',
                    'requirement-url': 'req://f',
                    transitions: [
                        { 'relationship-unique-id': 'r2', 'sequence-number': 1, description: '' },
                    ],
                    controls: { C3: ctrl('flow-level C3') },
                } as CalmFlowCanonicalModel,
            ],
        };

        const strat = new ControlFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusControls: ['C3'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r2']); // from the flow transitions
        expect(res.seedNodes).toEqual(new Set(['svcC', 'dbB']));
        expect(res.visibleNodes).toEqual(new Set(['svcC', 'dbB']));
        expect(res.warnings).toEqual([]);
    });

    it('relationship-level control: matches C1 on r1 → r1 active; controlNodes = endpoints (svcA, dbB)', () => {
        const strat = new ControlFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusControls: ['C1'] };
        const res = strat.applyFilter(baseModel, opts, new Set(), baseModel.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1']);

        expect(res.seedNodes).toEqual(new Set(['svcA', 'dbB'])); // endpoints of r1
        expect(res.visibleNodes).toEqual(new Set(['svcA', 'dbB']));
        expect(res.warnings).toEqual([]);
    });

    it('node-level control: matches nodes with C2; activeRelationships include edges touching those nodes', () => {
        const strat = new ControlFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusControls: ['C2'] };
        const res = strat.applyFilter(baseModel, opts, new Set(), baseModel.relationships);

        // nodes with C2: svcA and dbB; any relationship touching them is included → r1 (svcA–dbB) and r2 (dbB–svcC)
        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']);
        // NOTE: It does NOT add svcC just because r2 is active; only the nodes that *carry* controls are added.
        expect(res.seedNodes).toEqual(new Set(['svcA', 'dbB']));
        expect(res.visibleNodes).toEqual(new Set(['svcA', 'dbB']));
        expect(res.warnings).toEqual([]);
    });

    it('mixed controls (C1 + C2): merges node-level and relationship-level matches', () => {
        const strat = new ControlFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusControls: ['C1', 'C2'] };
        const res = strat.applyFilter(baseModel, opts, new Set(), baseModel.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']);

        expect(res.seedNodes).toEqual(new Set(['svcA', 'dbB']));
        expect(res.visibleNodes).toEqual(new Set(['svcA', 'dbB']));
        expect(res.warnings).toEqual([]);
    });

    it('no matching controls: pass-through all relationships, warn, no node additions', () => {
        const strat = new ControlFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusControls: ['NOPE'] };
        const res = strat.applyFilter(baseModel, opts, new Set(), baseModel.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']); // pass-through
        expect(res.seedNodes).toBeUndefined();
        expect(res.visibleNodes.size).toBe(0);
        expect(res.warnings.length).toBeGreaterThan(0);
    });
});
