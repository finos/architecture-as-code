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

    describe('transformToViewModel – relationship-id not found', () => {
        it('returns the requested relationshipId with empty relatedRelationships', () => {
            const arch = mkArch([
                mkRel('rel-1', { connects: { source: { node: 'A' }, destination: { node: 'B' } } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'relationship-id': 'missing' });
            expect(vm.relationshipId).toBe('missing');
            expect(vm.relatedRelationships).toEqual([]);
        });
    });

    describe('transformToViewModel – node-id path covers every canonical kind', () => {
        it('includes relationships where the node is the interacts actor', () => {
            const arch = mkArch([
                mkRel('r', { interacts: { actor: 'ServiceA', nodes: ['ServiceB', 'ServiceC'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'ServiceA' });
            expect(vm.relatedRelationships).toHaveLength(1);
            expect(vm.relatedRelationships[0]).toMatchObject({
                kind: 'interacts',
                actor: 'ServiceA',
            });
        });

        it('filters interacts.nodes down to just the target when the node is one of the targets', () => {
            const arch = mkArch([
                mkRel('r', { interacts: { actor: 'ServiceA', nodes: ['ServiceB', 'ServiceC'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'ServiceB' });
            expect(vm.relatedRelationships).toHaveLength(1);
            expect(vm.relatedRelationships[0]).toMatchObject({
                kind: 'interacts',
                actor: 'ServiceA',
                nodes: ['ServiceB'],
            });
        });

        it('includes deployed-in where the node is the container, untouched', () => {
            const arch = mkArch([
                mkRel('r', { 'deployed-in': { container: 'SystemX', nodes: ['Svc1', 'Svc2'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'SystemX' });
            expect(vm.relatedRelationships[0]).toMatchObject({
                kind: 'deployed-in',
                container: 'SystemX',
                nodes: ['Svc1', 'Svc2'],
            });
        });

        it('filters deployed-in.nodes down to the target when the node is one of the deployees', () => {
            const arch = mkArch([
                mkRel('r', { 'deployed-in': { container: 'SystemX', nodes: ['Svc1', 'Svc2'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'Svc1' });
            expect(vm.relatedRelationships[0]).toMatchObject({
                kind: 'deployed-in',
                container: 'SystemX',
                nodes: ['Svc1'],
            });
        });

        it('drops composed-of when neither container nor nodes match (still mapped, but filtered out)', () => {
            const arch = mkArch([
                mkRel('r', { 'composed-of': { container: 'SystemX', nodes: ['Svc1'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'Unrelated' });
            expect(vm.relatedRelationships).toHaveLength(0);
        });

        it('returns composed-of unchanged when the node IS the container', () => {
            const arch = mkArch([
                mkRel('r', { 'composed-of': { container: 'SystemX', nodes: ['Svc1', 'Svc2'] } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'SystemX' });
            expect(vm.relatedRelationships[0]).toMatchObject({
                kind: 'composed-of',
                container: 'SystemX',
                nodes: ['Svc1', 'Svc2'],
            });
        });

        it('matches connects on the destination side as well as the source side', () => {
            const arch = mkArch([
                mkRel('r', { connects: { source: { node: 'A' }, destination: { node: 'B' } } }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'B' });
            expect(vm.relatedRelationships[0].kind).toBe('connects');
        });

        it('excludes options-kind relationships (default filter branch is false)', () => {
            const arch = mkArch([
                mkRel('opt', { options: [{ description: 'd', nodes: [] as string[], relationships: [] as string[] }] }),
            ]);
            const vm = RelatedNodesWidget.transformToViewModel!(arch, { 'node-id': 'AnyNode' });
            expect(vm.relatedRelationships).toEqual([]);
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

        it('returns an empty view model when context is not a CalmCoreCanonicalModel', () => {
            const vm = RelatedNodesWidget.transformToViewModel!({} as never, { 'node-id': 'x' });
            expect(vm).toEqual({ relatedRelationships: [] });
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
