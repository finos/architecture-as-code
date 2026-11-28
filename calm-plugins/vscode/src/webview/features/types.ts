import type { ComponentType, ReactNode, RefObject } from 'react';
import type { Edge, Node, NodeTypes } from 'reactflow';

export type CanvasFeatureId = string;

export interface CanvasToolbarState {
    readonlyMode: boolean;
}

export interface CanvasFeatureCanvasView {
    nodes: Node[];
    edges: Edge[];
}

/** Core-owned capabilities passed to actions and feature surfaces; features do not import App. */
export interface CanvasFeatureRuntime {
    readonlyMode: boolean;
    nodes: Node[];
    edges: Edge[];
    selectedNode: Node | null;
    selectedEdge: Edge | null;
    expandControlKey: string | null;
    containerRef: RefObject<HTMLElement | null>;
    setSelectedNode: (node: Node | null) => void;
    setSelectedEdge: (edge: Edge | null) => void;
    setExpandControlKey: (key: string | null) => void;
    setNodes: (nodes: Node[] | ((current: Node[]) => Node[])) => void;
    setEdges: (edges: Edge[] | ((current: Edge[]) => Edge[])) => void;
    updateNode: (nodeId: string, field: string, value: unknown) => void;
    getCurrentNodes: () => Node[];
    getCurrentEdges: () => Edge[];
    enrichNodeControls: (nodes: Node[]) => void;
    enrichAllControls: () => void;
    emitChange: (immediate?: boolean) => void;
    postMessage: (message: unknown) => void;
    loadArchitecture: (json: string) => void;
    paletteSearchQuery?: string;
}

/** The smaller capability set needed to handle a drag payload before core node creation. */
export interface CanvasFeatureDropContext {
    readonlyMode: boolean;
    nodes: Node[];
    edges: Edge[];
    setNodes: CanvasFeatureRuntime['setNodes'];
    setEdges: CanvasFeatureRuntime['setEdges'];
    getCurrentNodes: CanvasFeatureRuntime['getCurrentNodes'];
    enrichNodeControls: CanvasFeatureRuntime['enrichNodeControls'];
    enrichAllControls: CanvasFeatureRuntime['enrichAllControls'];
    emitChange: CanvasFeatureRuntime['emitChange'];
    postMessage: CanvasFeatureRuntime['postMessage'];
    clientX: number;
    clientY: number;
    screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
    dataTransfer: DataTransfer;
}

/** Named composition points supplied by the core canvas. */
export type CanvasFeatureSlot = 'canvas' | 'properties' | 'palette' | 'overlay' | 'modal';

export type CanvasFeatureSurface = ComponentType<{ runtime: CanvasFeatureRuntime; children?: ReactNode }>;

export interface CanvasToolbarAction {
    id: string;
    label: string | ((runtime: CanvasFeatureRuntime) => string);
    title?: string | ((runtime: CanvasFeatureRuntime) => string);
    className?: string;
    execute?: (runtime: CanvasFeatureRuntime) => void;
    group: string;
    order: number;
    visibleWhen?: 'editable' | ((runtime: CanvasFeatureRuntime) => boolean);
    disabledWhen?: (runtime: CanvasFeatureRuntime) => boolean;
}

export interface CanvasMenuAction {
    id: string;
    label: string;
    order: number;
    execute?: (runtime: CanvasFeatureRuntime) => void;
    visibleWhen?: 'editable' | ((runtime: CanvasFeatureRuntime) => boolean);
}

export interface CanvasFeatureDefinition {
    id: CanvasFeatureId;
    toolbarActions?: readonly CanvasToolbarAction[];
    menuActions?: readonly CanvasMenuAction[];
    surfaces?: Partial<Record<CanvasFeatureSlot, CanvasFeatureSurface>>;
    nodeTypes?: Partial<NodeTypes>;
    onDrop?: (context: CanvasFeatureDropContext) => boolean;
    /** Decorates the rendered view only; returned styles are never serialized to CALM. */
    transformCanvas?: (view: CanvasFeatureCanvasView) => CanvasFeatureCanvasView;
    /** Runs after relationship deletion so a feature can preserve its model invariants. */
    onRelationshipsDeleted?: (relationshipIds: ReadonlySet<string>) => void;
}