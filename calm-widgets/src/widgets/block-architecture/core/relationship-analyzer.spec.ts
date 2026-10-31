import { describe, it, expect } from 'vitest';
import { buildParentHierarchy } from './relationship-analyzer';
import { CalmRelationshipCanonicalModel } from '@finos/calm-models/canonical';

const rel = (id: string, rt: CalmRelationshipCanonicalModel['relationship-type']): CalmRelationshipCanonicalModel => ({
    'unique-id': id,
    'relationship-type': rt,
});

describe('relationship-analyzer (extra cases)', () => {
    it('nests composed container under deployed container when both exist for same node and no cycle', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['n1'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['n1', 'C'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('C')?.[0]).toBe('D');
        expect(res.parentsOf.get('n1')?.[0]).toBe('C');
    });

    it('prevents cycles when attempting to nest containers mutually', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['n'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['C'] } }),
            // This would try to make C <- D and D <- C; the second edge must be blocked
            rel('r3', { 'deployed-in': { container: 'C', nodes: ['D'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('n')?.[0]).toBe('C');
        expect(res.parentsOf.get('C')?.[0]).toBe('D');
        expect(res.parentsOf.get('D')?.[0]).not.toBe('C');
    });

    it('keeps every deployed-in parent of a node', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'D1', nodes: ['x'] } }),
            rel('r2', { 'deployed-in': { container: 'D2', nodes: ['x'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('x')).toEqual(['D1', 'D2']);
    });

    it('keeps every composed-of parent of a node', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C1', nodes: ['x'] } }),
            rel('r2', { 'composed-of': { container: 'C2', nodes: ['x'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('x')).toEqual(['C1', 'C2']);
    });

    it('keeps a parent that is already an ancestor through another parent, for when the inner one is hidden', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'cluster', nodes: ['ns', 'svc'] } }),
            rel('r2', { 'deployed-in': { container: 'ns', nodes: ['svc'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('svc')).toEqual(['cluster', 'ns']);
    });

    it('gives each node the parent main gave it in a cycle, before any other parent', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'a', nodes: ['b'] } }),
            rel('r2', { 'deployed-in': { container: 'b', nodes: ['a', 'c'] } }),
            rel('r3', { 'deployed-in': { container: 'c', nodes: ['a', 'svc'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('b')).toEqual(['a']);
        expect(res.parentsOf.get('c')).toEqual(['b']);
        expect(res.parentsOf.get('svc')).toEqual(['c']);
        expect(res.parentsOf.get('a')).toBeUndefined();
    });

    it('lists a parent once when several relationships repeat it', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'D', nodes: ['x'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['x'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('x')).toEqual(['D']);
    });

    it('nests a composed container under one deployed container of its members', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['n'] } }),
            rel('r2', { 'deployed-in': { container: 'D1', nodes: ['n'] } }),
            rel('r3', { 'deployed-in': { container: 'D2', nodes: ['n'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('n')).toEqual(['C']);
        expect(res.parentsOf.get('C')).toEqual(['D1']);
    });

    it('does not copy a composed container whose members are deployed in different containers', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['svc1', 'svc2'] } }),
            rel('r2', { 'deployed-in': { container: 'A', nodes: ['svc1'] } }),
            rel('r3', { 'deployed-in': { container: 'B', nodes: ['svc2'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('C')).toEqual(['B']);
        expect(res.parentsOf.get('svc1')).toEqual(['C']);
        expect(res.parentsOf.get('svc2')).toEqual(['C']);
    });

    it('takes the next parent of the same kind when the first one closes a cycle', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'a', nodes: ['b'] } }),
            rel('r2', { 'deployed-in': { container: 'b', nodes: ['a'] } }),
            rel('r3', { 'deployed-in': { container: 'c', nodes: ['a'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('a')).toEqual(['c']);
    });

    it('rejects a later parent that closes a cycle', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'p1', nodes: ['x'] } }),
            rel('r2', { 'deployed-in': { container: 'p2', nodes: ['x'] } }),
            rel('r3', { 'deployed-in': { container: 'x', nodes: ['p2'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('x')).toEqual(['p1']);
        expect(res.parentsOf.get('p2')).toEqual(['x']);
    });

    it('accepts a parent whose ancestors meet again, as in a diamond', () => {
        // x is in N1 and N2, both in K. y's second parent z is in x, so the walk up from z reaches K twice.
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'K', nodes: ['N1', 'N2'] } }),
            rel('r2', { 'deployed-in': { container: 'N1', nodes: ['x'] } }),
            rel('r3', { 'deployed-in': { container: 'N2', nodes: ['x'] } }),
            rel('r4', { 'deployed-in': { container: 'x', nodes: ['z'] } }),
            rel('r5', { 'deployed-in': { container: 'w', nodes: ['y'] } }),
            rel('r6', { 'deployed-in': { container: 'z', nodes: ['y'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('x')).toEqual(['N1', 'N2']);
        expect(res.parentsOf.get('y')).toEqual(['w', 'z']);
    });

    it('nests only the first composing container under the deployed container', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C1', nodes: ['m'] } }),
            rel('r2', { 'composed-of': { container: 'C2', nodes: ['m'] } }),
            rel('r3', { 'deployed-in': { container: 'D', nodes: ['m'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('C1')).toEqual(['D']);
        expect(res.parentsOf.has('C2')).toBe(false);
    });

    it('falls back to deployed-in parents when every composed-of parent creates a cycle', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'X', nodes: ['Y', 'lx'] } }),
            rel('r2', { 'composed-of': { container: 'Y', nodes: ['X', 'ly'] } }),
            rel('r3', { 'deployed-in': { container: 'Z', nodes: ['X'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('Y')).toEqual(['X']);
        expect(res.parentsOf.get('X')).toEqual(['Z']);
    });

    it('applies nesting parents before direct parents when they conflict', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['m'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['m'] } }),
            rel('r3', { 'composed-of': { container: 'C', nodes: ['D'] } }),
            rel('r4', { 'composed-of': { container: 'D', nodes: ['dl'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('C')).toEqual(['D']);
        expect(res.parentsOf.get('D')).toBeUndefined();
    });

    it('rejects a parent that is reached through any ancestor of the child', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'env', nodes: ['cluster-a', 'cluster-b'] } }),
            rel('r2', { 'deployed-in': { container: 'cluster-b', nodes: ['ns'] } }),
            rel('r3', { 'deployed-in': { container: 'ns', nodes: ['env'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('ns')).toEqual(['cluster-b']);
        expect(res.parentsOf.get('env')).toBeUndefined();
    });

    it('tracks allMentionedContainers across composed-of and deployed-in', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C1', nodes: ['a'] } }),
            rel('r2', { 'deployed-in': { container: 'D1', nodes: ['b'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.allMentionedContainers.has('C1')).toBe(true);
        expect(res.allMentionedContainers.has('D1')).toBe(true);
    });

    it('accumulates childrenOfContainer for both relationship kinds', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['c1', 'c2'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['d1', 'd2', 'c1'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.childrenOfContainer.get('C')).toEqual(new Set(['c1', 'c2']));
        expect(res.childrenOfContainer.get('D')).toEqual(new Set(['d1', 'd2', 'c1']));
    });

    it('composition wins for node placement when both kinds exist for a node', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['n1'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['n1'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('n1')?.[0]).toBe('C');
    });

    it('self-parent assignment is rejected as a cycle', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['C'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('C')?.[0]).toBeUndefined();
        expect(res.childrenOfContainer.get('C')).toEqual(new Set(['C']));
    });

    it('deploy-only nodes are attached to deployed container', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'D', nodes: ['n2'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentsOf.get('n2')?.[0]).toBe('D');
    });
});
