import { describe, it, expect } from 'vitest';
import { validateCalmArchitecture } from './validation';
import type { CalmArchitecture } from './types';

function archWith(flows: unknown[], relationships: unknown[] = [{ 'unique-id': 'r1', 'relationship-type': { connects: { source: { node: 'a' }, destination: { node: 'b' } } } }]): CalmArchitecture {
    return {
        nodes: [
            { 'unique-id': 'a', 'node-type': 'service', name: 'A', description: 'svc' },
            { 'unique-id': 'b', 'node-type': 'service', name: 'B', description: 'svc' },
        ],
        relationships,
        flows,
    } as CalmArchitecture;
}

describe('validation — flow rules', () => {
    it('reports duplicate flow unique-ids', () => {
        const arch = archWith([
            { 'unique-id': 'f1', name: 'A', description: '', transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' }] },
            { 'unique-id': 'f1', name: 'B', description: '', transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' }] },
        ]);
        const issues = validateCalmArchitecture(arch);
        expect(issues.some(i => i.severity === 'error' && i.message.includes('Duplicate flow unique-id'))).toBe(true);
    });

    it('reports dangling relationship references in transitions', () => {
        const arch = archWith([
            { 'unique-id': 'f1', name: 'A', description: '', transitions: [{ 'relationship-unique-id': 'nonexistent', 'sequence-number': 1, description: '' }] },
        ]);
        const issues = validateCalmArchitecture(arch);
        expect(issues.some(i => i.severity === 'error' && i.message.includes('unknown relationship'))).toBe(true);
    });

    it('reports empty transitions as warning', () => {
        const arch = archWith([
            { 'unique-id': 'f1', name: 'A', description: '', transitions: [] },
        ]);
        const issues = validateCalmArchitecture(arch);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('no transitions'))).toBe(true);
    });

    it('reports sequence number gaps', () => {
        const arch = archWith([
            { 'unique-id': 'f1', name: 'A', description: '', transitions: [
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' },
                { 'relationship-unique-id': 'r1', 'sequence-number': 10, description: '' },
            ] },
        ]);
        const issues = validateCalmArchitecture(arch);
        expect(issues.some(i => i.severity === 'warning' && i.message.includes('sequence gap'))).toBe(true);
    });

    it('does not report issues for valid flows', () => {
        const arch = archWith([
            { 'unique-id': 'f1', name: 'A', description: '', transitions: [
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'step 1' },
                { 'relationship-unique-id': 'r1', 'sequence-number': 2, description: 'step 2' },
            ] },
        ]);
        const issues = validateCalmArchitecture(arch);
        const flowIssues = issues.filter(i => i.message.includes('flow') || i.message.includes('Flow'));
        expect(flowIssues).toHaveLength(0);
    });

    it('allows duplicate sequence numbers (parallel flows)', () => {
        const arch = archWith([
            { 'unique-id': 'f1', name: 'A', description: '', transitions: [
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' },
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' },
                { 'relationship-unique-id': 'r1', 'sequence-number': 2, description: '' },
            ] },
        ]);
        const issues = validateCalmArchitecture(arch);
        const gapIssues = issues.filter(i => i.message.includes('sequence gap'));
        expect(gapIssues).toHaveLength(0);
    });

    it('skips flow validation when no flows present', () => {
        const arch = archWith([]);
        const issues = validateCalmArchitecture(arch);
        const flowIssues = issues.filter(i => i.message.toLowerCase().includes('flow'));
        expect(flowIssues).toHaveLength(0);
    });
});
