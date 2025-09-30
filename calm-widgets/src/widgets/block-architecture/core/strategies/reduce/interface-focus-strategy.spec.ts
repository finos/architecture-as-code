import { describe, it, expect } from 'vitest';
import { InterfaceFocusStrategy } from './interface-focus-strategy';
import {
    CalmCoreCanonicalModel,
    CalmRelationshipCanonicalModel,
} from '@finos/calm-models/canonical';
import { NormalizedOptions } from '../../../types';

const baseOpts = (): NormalizedOptions => ({
    includeContainers: 'all',
    includeChildren: 'all',
    edges: 'connected',
    direction: 'both',
    renderInterfaces: false,
    edgeLabels: 'description',
    collapseRelationships: false,
});

function relConnects(
    id: string,
    srcNode: string,
    srcIface: string,
    dstNode: string,
    dstIface: string
): CalmRelationshipCanonicalModel {
    return {
        'unique-id': id,
        'relationship-type': {
            connects: {
                source: { node: srcNode, interfaces: [srcIface] },
                destination: { node: dstNode, interfaces: [dstIface] },
            },
        },
    };
}

const model: CalmCoreCanonicalModel = {
    nodes: [
        { 'unique-id': 'svcA', 'node-type': 'service', name: 'svcA', description: '', interfaces: [{ 'unique-id': 'api' }, { 'unique-id': 'events' }] },
        { 'unique-id': 'dbB', 'node-type': 'database', name: 'dbB', description: '', interfaces: [{ 'unique-id': 'jdbc' }] },
        { 'unique-id': 'svcC', 'node-type': 'service', name: 'svcC', description: '' },
    ],
    relationships: [
        relConnects('r1', 'svcA', 'api', 'dbB', 'jdbc'),
        relConnects('r2', 'svcA', 'events', 'svcC', 'api'),
    ],
};

describe('InterfaceFocusStrategy', () => {
    it('no focusInterfaces → passes through nodes but activates all relationships', () => {
        const strat = new InterfaceFocusStrategy();
        const res = strat.applyFilter(model, baseOpts(), new Set(), model.relationships);

        // all connects relationships are active
        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']);

        // visibleNodes unchanged (we passed empty)
        expect(res.visibleNodes.size).toBe(0);
        expect(res.warnings).toEqual([]);
    });

    it('focus "api" → matches relationships using "api" (src or dest) and adds only nodes that expose "api"', () => {
        const strat = new InterfaceFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusInterfaces: ['api'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        // r1 (src=api) and r2 (dest=api) both match
        expect(activeIds).toEqual(['r1', 'r2']);

        // Only nodes that actually expose the matched interface are added (svcA exposes 'api')
        expect(res.visibleNodes).toEqual(new Set(['svcA']));
    });

    it('invalid interface focus → activates all relationships and warns; does not add nodes', () => {
        const strat = new InterfaceFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusInterfaces: ['nope'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']); // all relationships passed through

        expect(res.visibleNodes.size).toBe(0);
        expect(res.warnings.length).toBeGreaterThan(0);
    });

    it('multiple interfaces merge and dedupe; nodes include only those exposing matched interfaces', () => {
        const strat = new InterfaceFocusStrategy();
        const opts: NormalizedOptions = { ...baseOpts(), focusInterfaces: ['api', 'jdbc', 'api'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);

        const activeIds = (res.activeRelationships ?? [])
            .map((r: CalmRelationshipCanonicalModel) => r['unique-id'])
            .sort();
        expect(activeIds).toEqual(['r1', 'r2']); // r1 via api/jdbc, r2 via api

        expect(res.visibleNodes).toEqual(new Set(['svcA', 'dbB'])); // svcA exposes api, dbB exposes jdbc
    });
});
