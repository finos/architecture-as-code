import { describe, it, expect } from 'vitest';
import { RelatedNodesWidget } from './index';
import {
    CalmCoreCanonicalModel,
    CalmNodeCanonicalModel,
    CalmRelationshipCanonicalModel,
    CalmRelationshipTypeCanonicalModel,
} from '@finos/calm-models/canonical';

const mkArch = (
    relationships: CalmRelationshipCanonicalModel[] = [],
    nodes: CalmNodeCanonicalModel[] = []
): CalmCoreCanonicalModel => ({
    nodes,
    relationships,
    metadata: {},
    controls: {},
    flows: [],
    adrs: [],
});

const mkRel = (
    id: string,
    rt: CalmRelationshipTypeCanonicalModel
): CalmRelationshipCanonicalModel => ({
    'unique-id': id,
    'relationship-type': rt,
    metadata: {},
    controls: {},
});

describe('RelatedNodesWidget', () => {
    describe('validateContext', () => {
        it('rejects null and non-architectures; accepts minimal CalmCoreCanonicalModel (nodes+relationships)', () => {
            expect(RelatedNodesWidget.validateContext(null)).toBe(false);
            expect(RelatedNodesWidget.validateContext({})).toBe(false);

            const ok = mkArch([], []);
            expect(RelatedNodesWidget.validateContext(ok)).toBe(true);

            const okWithRel = mkArch([
                mkRel('r', { interacts: { actor: 'x', nodes: [] as string[] } }),
            ]);
            expect(RelatedNodesWidget.validateContext(okWithRel)).toBe(true);
        });
    });

    describe('transformToViewModel – relationship-id path', () => {
        it('finds a canonical relationship by unique-id and returns a kind view', () => {
            const arch = mkArch([
                mkRel('rel-1', { connects: { source: { node: 'A' }, destination: { node: 'B' } } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'relationship-id': 'rel-1' });
            expect(vm.relationshipId).toBe('rel-1');
            expect(vm.id).toBeUndefined();
            expect(vm.relatedRelationships).toHaveLength(1);
            expect(vm.relatedRelationships[0].kind).toBe('connects');
        });
    });

    describe('transformToViewModel – node-id path', () => {
        it('computes related relationships for connects + composed-of (canonical)', () => {
            const arch = mkArch([
                mkRel('r1', { connects: { source: { node: 'ServiceA' }, destination: { node: 'ServiceB' } } }),
                mkRel('r2', { 'composed-of': { container: 'SystemC', nodes: ['ServiceA'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'ServiceA' });
            expect(vm.id).toBe('ServiceA');
            expect(vm.nodeId).toBe('ServiceA');
            expect(vm.relationshipId).toBeUndefined();
            expect(vm.relatedRelationships.length).toBeGreaterThan(0);
            const kinds = vm.relatedRelationships.map(r => r.kind);
            expect(new Set(kinds)).toEqual(new Set(['connects', 'composed-of']));
        });
    });

    describe('transformToViewModel – defaults and invariants', () => {
        it('returns empty when no options are provided', () => {
            const arch = mkArch([
                mkRel('r1', { connects: { source: { node: 'A' }, destination: { node: 'B' } } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch);
            expect(vm.relatedRelationships).toHaveLength(0);
        });

        it('produces kind-view consistently for all canonical shapes', () => {
            const samples: CalmRelationshipCanonicalModel[] = [
                mkRel('i',  { interacts:   { actor: 'U', nodes: ['V'] } }),
                mkRel('c',  { connects:    { source: { node: 'S' }, destination: { node: 'D' } } }),
                mkRel('co', { 'composed-of': { container: 'C', nodes: ['N'] } }),
                mkRel('di', { 'deployed-in': { container: 'X', nodes: ['Y'] } }),
                mkRel('op', { options: [{ description: 'd', nodes: [] as string[], relationships: [] as string[] }] }),
            ];
            const arch = mkArch(samples);
            for (const r of samples) {
                const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'relationship-id': r['unique-id'] });
                expect(vm.relatedRelationships).toHaveLength(1);
                const t = vm.relatedRelationships[0];
                expect(['interacts', 'connects', 'composed-of', 'deployed-in', 'options']).toContain(t.kind);
            }
        });
    });
});
