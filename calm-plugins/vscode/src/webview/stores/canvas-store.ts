import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';

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
    buildingBlocks: unknown[];
    loadedPatterns: unknown[];
    loadedTemplates: unknown[];
    loadedStandards: unknown[];

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
    buildingBlocks: [],
    loadedPatterns: [],
    loadedTemplates: [],
    loadedStandards: [],

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
}));
