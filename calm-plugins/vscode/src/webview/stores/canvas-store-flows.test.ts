import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './canvas-store';

const flow1 = { 'unique-id': 'flow-1', name: 'Flow One', description: '', transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' }] };
const flow2 = { 'unique-id': 'flow-2', name: 'Flow Two', description: '', transitions: [{ 'relationship-unique-id': 'r2', 'sequence-number': 1, description: '' }] };

beforeEach(() => {
    useCanvasStore.setState({ flows: [], activeFlowId: null, flowHighlightEnabled: false, canvasMode: 'architecture' });
});

describe('canvas-store flow actions', () => {
    it('clears stale selection and sequence mode when flows are cleared', () => {
        useCanvasStore.setState({ flows: [flow1], activeFlowId: 'flow-1', canvasMode: 'sequence', hubLoading: true, standardNodes: [{ id: 'svc' }] });
        useCanvasStore.getState().setFlows([]);
        expect(useCanvasStore.getState()).toMatchObject({
            flows: [], activeFlowId: null, canvasMode: 'architecture',
            hubLoading: true, standardNodes: [{ id: 'svc' }],
        });
    });

    it('clears a selection missing from the new document', () => {
        useCanvasStore.setState({ flows: [flow1], activeFlowId: 'flow-1' });
        useCanvasStore.getState().setFlows([flow2]);
        expect(useCanvasStore.getState().activeFlowId).toBeNull();
    });

    it('returns to architecture mode after deleting the last flow', () => {
        useCanvasStore.setState({ flows: [flow1], activeFlowId: '__all__', canvasMode: 'sequence' });
        useCanvasStore.getState().removeFlow('flow-1');
        expect(useCanvasStore.getState()).toMatchObject({ flows: [], activeFlowId: null, canvasMode: 'architecture' });
    });

    it('preserves sequence mode and selection when removing an unknown flow', () => {
        useCanvasStore.setState({ flows: [flow1], activeFlowId: 'flow-1', canvasMode: 'sequence' });
        useCanvasStore.getState().removeFlow('missing');
        expect(useCanvasStore.getState()).toMatchObject({ flows: [flow1], activeFlowId: 'flow-1', canvasMode: 'sequence' });
    });

    it('setFlows replaces the flows array', () => {
        useCanvasStore.getState().setFlows([flow1, flow2]);
        expect(useCanvasStore.getState().flows).toHaveLength(2);
    });

    it('addFlow appends to the array', () => {
        useCanvasStore.getState().setFlows([flow1]);
        useCanvasStore.getState().addFlow(flow2);
        expect(useCanvasStore.getState().flows).toHaveLength(2);
        expect(useCanvasStore.getState().flows[1]['unique-id']).toBe('flow-2');
    });

    it('updateFlow merges partial updates', () => {
        useCanvasStore.getState().setFlows([flow1]);
        useCanvasStore.getState().updateFlow('flow-1', { name: 'Updated' });
        expect(useCanvasStore.getState().flows[0].name).toBe('Updated');
        expect(useCanvasStore.getState().flows[0].description).toBe('');
    });

    it('updateFlow does not affect other flows', () => {
        useCanvasStore.getState().setFlows([flow1, flow2]);
        useCanvasStore.getState().updateFlow('flow-1', { name: 'Changed' });
        expect(useCanvasStore.getState().flows[1].name).toBe('Flow Two');
    });

    it('removeFlow removes the flow', () => {
        useCanvasStore.getState().setFlows([flow1, flow2]);
        useCanvasStore.getState().removeFlow('flow-1');
        expect(useCanvasStore.getState().flows).toHaveLength(1);
        expect(useCanvasStore.getState().flows[0]['unique-id']).toBe('flow-2');
    });

    it('removeFlow clears activeFlowId if it matches', () => {
        useCanvasStore.getState().setFlows([flow1, flow2]);
        useCanvasStore.getState().setActiveFlowId('flow-1');
        useCanvasStore.getState().removeFlow('flow-1');
        expect(useCanvasStore.getState().activeFlowId).toBeNull();
    });

    it('removeFlow preserves activeFlowId if it does not match', () => {
        useCanvasStore.getState().setFlows([flow1, flow2]);
        useCanvasStore.getState().setActiveFlowId('flow-2');
        useCanvasStore.getState().removeFlow('flow-1');
        expect(useCanvasStore.getState().activeFlowId).toBe('flow-2');
    });

    it('setCanvasMode switches mode', () => {
        useCanvasStore.getState().setCanvasMode('sequence');
        expect(useCanvasStore.getState().canvasMode).toBe('sequence');
    });

    it('updateFlow can replace transitions (simulates cleanup on edge delete)', () => {
        const flowWithMultiple = {
            'unique-id': 'flow-multi', name: 'Multi', description: '',
            transitions: [
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: 'step 1' },
                { 'relationship-unique-id': 'r2', 'sequence-number': 2, description: 'step 2' },
                { 'relationship-unique-id': 'r3', 'sequence-number': 3, description: 'step 3' },
            ],
        };
        useCanvasStore.getState().setFlows([flowWithMultiple]);

        const deletedRelIds = new Set(['r2']);
        const cleaned = flowWithMultiple.transitions.filter(t => !deletedRelIds.has(t['relationship-unique-id']));
        useCanvasStore.getState().updateFlow('flow-multi', { transitions: cleaned });

        const updated = useCanvasStore.getState().flows[0];
        expect(updated.transitions).toHaveLength(2);
        expect(updated.transitions[0]['relationship-unique-id']).toBe('r1');
        expect(updated.transitions[1]['relationship-unique-id']).toBe('r3');
    });

    it('cleanup falls back to placeholder when all transitions removed', () => {
        const flowSingle = {
            'unique-id': 'flow-single', name: 'Single', description: '',
            transitions: [{ 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' }],
        };
        useCanvasStore.getState().setFlows([flowSingle]);

        const deletedRelIds = new Set(['r1']);
        const cleaned = flowSingle.transitions.filter(t => !deletedRelIds.has(t['relationship-unique-id']));
        const safeTransitions = cleaned.length > 0 ? cleaned : [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }];
        useCanvasStore.getState().updateFlow('flow-single', { transitions: safeTransitions });

        const updated = useCanvasStore.getState().flows[0];
        expect(updated.transitions).toHaveLength(1);
        expect(updated.transitions[0]['relationship-unique-id']).toBe('');
    });

    it('cleanup preserves transitions for unrelated relationships', () => {
        const flow = {
            'unique-id': 'flow-keep', name: 'Keep', description: '',
            transitions: [
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' },
                { 'relationship-unique-id': 'r2', 'sequence-number': 2, description: '' },
            ],
        };
        useCanvasStore.getState().setFlows([flow]);

        const deletedRelIds = new Set(['r99']);
        const cleaned = flow.transitions.filter(t => !deletedRelIds.has(t['relationship-unique-id']));
        useCanvasStore.getState().updateFlow('flow-keep', { transitions: cleaned });

        expect(useCanvasStore.getState().flows[0].transitions).toHaveLength(2);
    });

    it('cleanup across multiple flows', () => {
        const flowA = {
            'unique-id': 'flow-a', name: 'A', description: '',
            transitions: [
                { 'relationship-unique-id': 'r1', 'sequence-number': 1, description: '' },
                { 'relationship-unique-id': 'r2', 'sequence-number': 2, description: '' },
            ],
        };
        const flowB = {
            'unique-id': 'flow-b', name: 'B', description: '',
            transitions: [
                { 'relationship-unique-id': 'r2', 'sequence-number': 1, description: '' },
                { 'relationship-unique-id': 'r3', 'sequence-number': 2, description: '' },
            ],
        };
        useCanvasStore.getState().setFlows([flowA, flowB]);

        const deletedRelIds = new Set(['r2']);
        for (const flow of useCanvasStore.getState().flows) {
            const cleaned = flow.transitions.filter(t => !deletedRelIds.has(t['relationship-unique-id']));
            if (cleaned.length !== flow.transitions.length) {
                useCanvasStore.getState().updateFlow(flow['unique-id'], {
                    transitions: cleaned.length > 0 ? cleaned : [{ 'relationship-unique-id': '', 'sequence-number': 1, description: '' }],
                });
            }
        }

        const flows = useCanvasStore.getState().flows;
        expect(flows[0].transitions).toHaveLength(1);
        expect(flows[0].transitions[0]['relationship-unique-id']).toBe('r1');
        expect(flows[1].transitions).toHaveLength(1);
        expect(flows[1].transitions[0]['relationship-unique-id']).toBe('r3');
    });
});
