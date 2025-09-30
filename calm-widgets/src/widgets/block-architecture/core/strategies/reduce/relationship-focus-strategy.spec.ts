import { describe, it, expect } from 'vitest';
import { RelationshipFocusStrategy } from './relationship-focus-strategy';
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
    collapseRelationships: false
});

function relConnects(id: string, sourceNode: string, sourceIface: string, destNode: string, destIface: string): CalmRelationshipCanonicalModel {
    return {
        'unique-id': id,
        'relationship-type': {
            connects: {
                source: { node: sourceNode, interfaces: [sourceIface] },
                destination: { node: destNode, interfaces: [destIface] }
            }
        },
        description: ''
    };
}

function relInteracts(id: string, actor: string, targets: string[]): CalmRelationshipCanonicalModel {
    return {
        'unique-id': id,
        'relationship-type': {
            interacts: { actor, nodes: targets }
        }
    };
}

function relDeployedIn(id: string, container: string, nodes: string[]): CalmRelationshipCanonicalModel {
    return {
        'unique-id': id,
        'relationship-type': { 'deployed-in': { container, nodes } }
    };
}

const ctx = (rels: CalmRelationshipCanonicalModel[]): CalmCoreCanonicalModel => ({
    nodes: [
        { 'unique-id': 'A', 'node-type': 'service', name: 'A', description: '', interfaces: [{ 'unique-id': 'api' }] },
        { 'unique-id': 'B', 'node-type': 'database', name: 'B', description: '', interfaces: [{ 'unique-id': 'jdbc' }] },
        { 'unique-id': 'C', 'node-type': 'system', name: 'C', description: '' },
        { 'unique-id': 'D', 'node-type': 'service', name: 'D', description: '' }
    ],
    relationships: rels
});

describe('RelationshipFocusStrategy', () => {
    it('no focus-relationships → no-op', () => {
        const strat = new RelationshipFocusStrategy();
        const model = ctx([relConnects('r1', 'A', 'api', 'B', 'jdbc')]);
        const res = strat.applyFilter(model, baseOpts(), new Set(['A']), model.relationships);
        expect(res.visibleNodes).toEqual(new Set(['A']));
        expect(res.activeRelationships).toBeUndefined();
        expect(res.warnings).toEqual([]);
    });

    it('focus by relationship IDs selects participating nodes and activeRelationships', () => {
        const strat = new RelationshipFocusStrategy();
        const rels = [
            relConnects('r1', 'A', 'api', 'B', 'jdbc'),
            relInteracts('r2', 'C', ['A', 'B']),
            relDeployedIn('r3', 'C', ['D'])
        ];
        const model = ctx(rels);
        const opts: NormalizedOptions = { ...baseOpts(), focusRelationships: ['r1', 'r3'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);
        expect(res.activeRelationships?.map(r => r['unique-id']).sort()).toEqual(['r1', 'r3']);
        expect(res.visibleNodes).toEqual(new Set(['A', 'B', 'C', 'D']));
        expect(res.seedNodes).toEqual(new Set(['A', 'B', 'C', 'D']));
    });

    it('invalid relationship IDs produce warnings and no additions', () => {
        const strat = new RelationshipFocusStrategy();
        const model = ctx([relConnects('r1', 'A', 'api', 'B', 'jdbc')]);
        const opts: NormalizedOptions = { ...baseOpts(), focusRelationships: ['nope'] };
        const res = strat.applyFilter(model, opts, new Set(), model.relationships);
        expect(res.activeRelationships).toBeUndefined();
        expect(res.visibleNodes.size).toBe(0);
        expect(res.warnings.length).toBeGreaterThan(0);
    });
});
