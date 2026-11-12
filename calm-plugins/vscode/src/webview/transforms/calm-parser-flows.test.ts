import { describe, it, expect } from 'vitest';
import { parseCALMData } from './calm-parser';
import { flowToCalm, setLastParsedArch, type CalmArchitecture } from './calm-editor-transformer';

const minimalArch: CalmArchitecture = {
    nodes: [
        { 'unique-id': 'svc-a', 'node-type': 'service', name: 'Service A', description: '' },
        { 'unique-id': 'svc-b', 'node-type': 'service', name: 'Service B', description: '' },
    ],
    relationships: [
        {
            'unique-id': 'rel-a-to-b',
            'relationship-type': { connects: { source: { node: 'svc-a' }, destination: { node: 'svc-b' } } },
        },
    ],
};

const archWithFlows: CalmArchitecture = {
    ...minimalArch,
    flows: [
        {
            'unique-id': 'flow-1',
            name: 'Payment Flow',
            description: 'Test flow',
            transitions: [
                { 'relationship-unique-id': 'rel-a-to-b', 'sequence-number': 1, description: 'A calls B' },
            ],
        },
    ],
};

describe('parseCALMData — flows', () => {
    it('returns empty flows when none are present', () => {
        const result = parseCALMData(minimalArch);
        expect(result.flows).toEqual([]);
    });

    it('returns parsed flows from architecture JSON', () => {
        const result = parseCALMData(archWithFlows);
        expect(result.flows).toHaveLength(1);
        expect(result.flows[0]['unique-id']).toBe('flow-1');
        expect(result.flows[0].name).toBe('Payment Flow');
        expect(result.flows[0].transitions).toHaveLength(1);
    });

    it('returns empty flows for null/empty architecture', () => {
        const result = parseCALMData({} as CalmArchitecture);
        expect(result.flows).toEqual([]);
    });
});

describe('flowToCalm — flows serialization', () => {
    it('serializes flows when provided', () => {
        const { nodes, edges } = parseCALMData(minimalArch);
        setLastParsedArch(minimalArch);
        const flows = archWithFlows.flows!;
        const result = flowToCalm(nodes, edges, undefined, flows);
        expect(result.flows).toEqual(flows);
    });

    it('omits flows key when array is empty', () => {
        const { nodes, edges } = parseCALMData(minimalArch);
        setLastParsedArch(minimalArch);
        const result = flowToCalm(nodes, edges, undefined, []);
        expect(result.flows).toBeUndefined();
    });

    it('does not duplicate flows via passthrough', () => {
        setLastParsedArch(archWithFlows);
        const { nodes, edges } = parseCALMData(archWithFlows);
        const updatedFlow = {
            ...archWithFlows.flows![0],
            name: 'Updated Flow',
        };
        const result = flowToCalm(nodes, edges, undefined, [updatedFlow]);
        expect(result.flows).toHaveLength(1);
        expect(result.flows![0].name).toBe('Updated Flow');
    });
});

describe('flow round-trip', () => {
    it('flows survive parse → serialize unchanged', () => {
        setLastParsedArch(archWithFlows);
        const { nodes, edges, flows } = parseCALMData(archWithFlows);
        const result = flowToCalm(nodes, edges, undefined, flows);
        expect(result.flows).toEqual(archWithFlows.flows);
    });
});

describe('edge label truncation', () => {
    it('truncates long descriptions on edge labels', () => {
        const arch: CalmArchitecture = {
            ...minimalArch,
            relationships: [
                {
                    'unique-id': 'rel-long',
                    'relationship-type': { connects: { source: { node: 'svc-a' }, destination: { node: 'svc-b' } } },
                    description: 'This is a very long description that should be truncated on the edge label',
                },
            ],
        };
        const result = parseCALMData(arch);
        const edge = result.edges.find(e => (e.data as any)?.calmRelId === 'rel-long');
        expect(edge).toBeDefined();
        expect((edge!.label as string).length).toBeLessThanOrEqual(33);
        expect((edge!.label as string).endsWith('...')).toBe(true);
    });

    it('does not truncate short descriptions', () => {
        const arch: CalmArchitecture = {
            ...minimalArch,
            relationships: [
                {
                    'unique-id': 'rel-short',
                    'relationship-type': { connects: { source: { node: 'svc-a' }, destination: { node: 'svc-b' } } },
                    description: 'Short desc',
                },
            ],
        };
        const result = parseCALMData(arch);
        const edge = result.edges.find(e => (e.data as any)?.calmRelId === 'rel-short');
        expect(edge!.label).toBe('Short desc');
    });

    it('preserves full description in edge data', () => {
        const longDesc = 'This is a very long description that should be truncated on the edge label';
        const arch: CalmArchitecture = {
            ...minimalArch,
            relationships: [
                {
                    'unique-id': 'rel-full',
                    'relationship-type': { connects: { source: { node: 'svc-a' }, destination: { node: 'svc-b' } } },
                    description: longDesc,
                },
            ],
        };
        const result = parseCALMData(arch);
        const edge = result.edges.find(e => (e.data as any)?.calmRelId === 'rel-full');
        expect((edge!.data as any).description).toBe(longDesc);
    });
});
