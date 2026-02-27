import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '@finos/calm-models/types';
import { NodeData, EdgeData } from './contracts.js';
import type { Flow } from './flow-contracts.js';
import type { Control } from './control-contracts.js';
import { Data } from '../../model/calm.js';

//These types and interfaces are used in the top-level visualizer components e.g. Drawer, Sidebar, ReactFlowVisualizer.

/**
 * Props for Drawer component
 */
export interface DrawerProps {
    data?: Data;
}

/**
 * Selected item from graph - either a node or edge
 */
export type SelectedItem = {
    data: NodeData | EdgeData;
} | null;

/**
 * Props for Sidebar component
 */
export interface SidebarProps {
    selectedData: NodeData | EdgeData;
    closeSidebar: () => void;
}

/**
 * Props for ReactFlowVisualizer component
 */
export interface ReactFlowVisualizerProps {
    calmData: CalmArchitectureSchema;
    onNodeClick?: (nodeData: CalmNodeSchema) => void;
    onEdgeClick?: (edgeData: CalmRelationshipSchema) => void;
    onBackgroundClick?: () => void;
}

/**
 * Props for ArchitectureGraph component
 */
export interface ArchitectureGraphProps {
    jsonData: CalmArchitectureSchema;
    onNodeClick?: (node: CalmNodeSchema) => void;
    onEdgeClick?: (edge: CalmRelationshipSchema) => void;
}

/**
 * Props for MetadataPanel component
 */
export interface MetadataPanelProps {
    flows: Flow[];
    controls: Record<string, Control>;
    onTransitionClick?: (relationshipId: string) => void;
    onNodeClick?: (nodeId: string) => void;
    onControlClick?: (controlId: string) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    height: number;
    onHeightChange: (height: number) => void;
}

/**
 * Tab type for MetadataPanel
 */
export type MetadataPanelTabType = 'flows' | 'controls';
