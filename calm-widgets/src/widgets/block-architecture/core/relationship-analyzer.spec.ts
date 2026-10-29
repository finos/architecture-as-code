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
        expect(res.parentOf.get('C')).toBe('D');
        expect(res.parentOf.get('n1')).toBe('C');
    });

    it('prevents cycles when attempting to nest containers mutually', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['n'] } }),
            rel('r2', { 'deployed-in': { container: 'D', nodes: ['C'] } }),
            // This would try to make C <- D and D <- C; the second edge must be blocked
            rel('r3', { 'deployed-in': { container: 'C', nodes: ['D'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentOf.get('n')).toBe('C');
        expect(res.parentOf.get('C')).toBe('D');
        expect(res.parentOf.get('D')).not.toBe('C');
    });

    it('keeps every deployed-in parent of a node without warnings', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'D1', nodes: ['x'] } }),
            rel('r2', { 'deployed-in': { container: 'D2', nodes: ['x'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.warnings).toEqual([]);
        expect(res.parentsOf.get('x')).toEqual(['D1', 'D2']);
        expect(res.parentOf.get('x')).toBe('D1');
    });

    it('keeps every composed-of parent of a node', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C1', nodes: ['x'] } }),
            rel('r2', { 'composed-of': { container: 'C2', nodes: ['x'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.warnings).toEqual([]);
        expect(res.parentsOf.get('x')).toEqual(['C1', 'C2']);
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
        expect(res.parentOf.get('n1')).toBe('C');
    });

    it('self-parent assignment is rejected as a cycle', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'composed-of': { container: 'C', nodes: ['C'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentOf.get('C')).toBeUndefined();
        expect(res.childrenOfContainer.get('C')).toEqual(new Set(['C']));
    });

    it('deploy-only nodes are attached to deployed container', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'D', nodes: ['n2'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.parentOf.get('n2')).toBe('D');
    });
});
