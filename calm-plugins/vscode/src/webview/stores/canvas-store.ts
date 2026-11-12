import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';
import type { CalmFlow } from '../../core/types';

export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    message: string;
    nodeId?: string;
    relationshipId?: string;
    controlId?: string;
}

export interface DrillEntry {
    label: string;
    filePath: string;
    readonly?: boolean;
}

export interface CanvasState {
    nodes: Node[];
    edges: Edge[];
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    validationIssues: ValidationIssue[];
    showValidation: boolean;
    readonlyMode: boolean;
    layoutDirection: 'DOWN' | 'RIGHT';
    drillStack: DrillEntry[];
    panelWidth: number;
    expandControlKey: string | null;
    documentControls: Record<string, unknown>;
    copiesLimited: boolean;
    standardNodes: unknown[];
    loadedPatterns: unknown[];
    hubLoading: boolean;
    flows: CalmFlow[];
    activeFlowId: string | null;
    flowHighlightEnabled: boolean;
    canvasMode: 'architecture' | 'sequence';

    // Actions
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    selectNode: (id: string | null) => void;
    selectEdge: (id: string | null) => void;
    setValidationIssues: (issues: ValidationIssue[]) => void;
    setShowValidation: (show: boolean) => void;
    setReadonlyMode: (readonly: boolean) => void;
    setLayoutDirection: (dir: 'DOWN' | 'RIGHT') => void;
    pushDrill: (entry: DrillEntry) => void;
    popDrill: (toIndex: number) => void;
    resetDrill: () => void;
    setPanelWidth: (width: number) => void;
    setExpandControlKey: (key: string | null) => void;
    setHubLoading: (loading: boolean) => void;
    setFlows: (flows: CalmFlow[]) => void;
    addFlow: (flow: CalmFlow) => void;
    updateFlow: (flowId: string, updates: Partial<CalmFlow>) => void;
    removeFlow: (flowId: string) => void;
    setActiveFlowId: (id: string | null) => void;
    setFlowHighlightEnabled: (enabled: boolean) => void;
    setCanvasMode: (mode: 'architecture' | 'sequence') => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
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
    copiesLimited: false,
    standardNodes: [],
    loadedPatterns: [],
    hubLoading: false,
    flows: [],
    activeFlowId: null,
    flowHighlightEnabled: false,
    canvasMode: 'architecture',

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),
    selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
    setValidationIssues: (issues) => set({ validationIssues: issues }),
    setShowValidation: (show) => set({ showValidation: show }),
    setReadonlyMode: (readonly) => set({ readonlyMode: readonly }),
    setLayoutDirection: (dir) => set({ layoutDirection: dir }),
    pushDrill: (entry) =>
        set((s) => ({ drillStack: [...s.drillStack, entry] })),
    popDrill: (toIndex) =>
        set((s) => ({ drillStack: s.drillStack.slice(0, toIndex) })),
    resetDrill: () => set({ drillStack: [], readonlyMode: false }),
    setPanelWidth: (width) => set({ panelWidth: width }),
    setExpandControlKey: (key) => set({ expandControlKey: key }),
    setHubLoading: (loading) => set({ hubLoading: loading }),
    setFlows: (flows) => set((s) => ({
        flows,
        activeFlowId: flows.length > 0 && (s.activeFlowId === '__all__' || flows.some(f => f['unique-id'] === s.activeFlowId)) ? s.activeFlowId : null,
        canvasMode: flows.length > 0 ? s.canvasMode : 'architecture',
    })),
    addFlow: (flow) => set((s) => ({ flows: [...s.flows, flow] })),
    updateFlow: (flowId, updates) => set((s) => ({
        flows: s.flows.map((f) =>
            f['unique-id'] === flowId ? { ...f, ...updates } : f
        ),
    })),
    removeFlow: (flowId) => set((s) => {
        const flows = s.flows.filter((f) => f['unique-id'] !== flowId);
        return {
            flows,
            activeFlowId: s.activeFlowId === flowId || flows.length === 0 ? null : s.activeFlowId,
            canvasMode: flows.length === 0 ? 'architecture' : s.canvasMode,
        };
    }),
    setActiveFlowId: (id) => set({ activeFlowId: id }),
    setFlowHighlightEnabled: (enabled) => set({ flowHighlightEnabled: enabled }),
    setCanvasMode: (mode) => set({ canvasMode: mode }),
}));
