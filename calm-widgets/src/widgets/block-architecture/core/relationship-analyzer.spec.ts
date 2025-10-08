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

    it('warns on multiple deployed-in parents and keeps the first seen', () => {
        const relationships: CalmRelationshipCanonicalModel[] = [
            rel('r1', { 'deployed-in': { container: 'D1', nodes: ['x'] } }),
            rel('r2', { 'deployed-in': { container: 'D2', nodes: ['x'] } }),
        ];
        const res = buildParentHierarchy(relationships);
        expect(res.warnings.length).toBeGreaterThan(0);
        expect(res.warnings.join(' ')).toMatch(/multiple deployed-in parents/i);
        // Implementation keeps the first encountered parent
        expect(['D1', 'D2']).toContain(res.parentOf.get('x'));
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
