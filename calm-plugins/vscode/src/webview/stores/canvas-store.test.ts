import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './canvas-store';

describe('canvas-store', () => {
    beforeEach(() => {
        useCanvasStore.setState({
            nodes: [],
            edges: [],
            selectedNodeId: null,
            selectedEdgeId: null,
            validationIssues: [],
            showValidation: false,
            readonlyMode: false,
            layoutDirection: 'DOWN',
            drillStack: [],
            panelWidth: 280,
            expandControlKey: null,
            documentControls: {},
            standardNodes: [],
            loadedPatterns: [],
            availableUpdates: [],
        });
    });

    it('initialises with default state', () => {
        const state = useCanvasStore.getState();
        expect(state.nodes).toEqual([]);
        expect(state.selectedNodeId).toBeNull();
        expect(state.readonlyMode).toBe(false);
        expect(state.layoutDirection).toBe('DOWN');
        expect(state.panelWidth).toBe(280);
    });

    it('selectNode clears selectedEdge', () => {
        useCanvasStore.getState().selectEdge('e1');
        expect(useCanvasStore.getState().selectedEdgeId).toBe('e1');

        useCanvasStore.getState().selectNode('n1');
        expect(useCanvasStore.getState().selectedNodeId).toBe('n1');
        expect(useCanvasStore.getState().selectedEdgeId).toBeNull();
    });

    it('selectEdge clears selectedNode', () => {
        useCanvasStore.getState().selectNode('n1');
        useCanvasStore.getState().selectEdge('e1');
        expect(useCanvasStore.getState().selectedEdgeId).toBe('e1');
        expect(useCanvasStore.getState().selectedNodeId).toBeNull();
    });

    it('pushDrill appends to stack', () => {
        useCanvasStore.getState().pushDrill({ label: 'A', filePath: '/a.json' });
        useCanvasStore.getState().pushDrill({ label: 'B', filePath: '/b.json', readonly: true });
        const stack = useCanvasStore.getState().drillStack;
        expect(stack).toHaveLength(2);
        expect(stack[1].label).toBe('B');
        expect(stack[1].readonly).toBe(true);
    });

    it('popDrill slices stack to index', () => {
        useCanvasStore.getState().pushDrill({ label: 'A', filePath: '/a.json' });
        useCanvasStore.getState().pushDrill({ label: 'B', filePath: '/b.json' });
        useCanvasStore.getState().pushDrill({ label: 'C', filePath: '/c.json' });
        useCanvasStore.getState().popDrill(1);
        expect(useCanvasStore.getState().drillStack).toHaveLength(1);
        expect(useCanvasStore.getState().drillStack[0].label).toBe('A');
    });

    it('resetDrill clears stack and readonlyMode', () => {
        useCanvasStore.getState().pushDrill({ label: 'A', filePath: '/a.json' });
        useCanvasStore.getState().setReadonlyMode(true);
        useCanvasStore.getState().resetDrill();
        expect(useCanvasStore.getState().drillStack).toHaveLength(0);
        expect(useCanvasStore.getState().readonlyMode).toBe(false);
    });

    it('setLayoutDirection toggles direction', () => {
        useCanvasStore.getState().setLayoutDirection('RIGHT');
        expect(useCanvasStore.getState().layoutDirection).toBe('RIGHT');
    });

    it('setValidationIssues stores issues', () => {
        useCanvasStore.getState().setValidationIssues([
            { severity: 'error', message: 'Missing name', nodeId: 'n1' },
        ]);
        expect(useCanvasStore.getState().validationIssues).toHaveLength(1);
        expect(useCanvasStore.getState().validationIssues[0].severity).toBe('error');
    });

    it('setAvailableUpdates stores update info', () => {
        useCanvasStore.getState().setAvailableUpdates([
            { nodeId: 'n1', currentSha: 'abc', latestSha: 'def' },
        ]);
        expect(useCanvasStore.getState().availableUpdates).toHaveLength(1);
    });
});
