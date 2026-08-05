import {
    CalmArchitectureSchema,
    CalmNodeSchema,
    CalmRelationshipSchema,
} from '@finos/calm-models/types';
import type { Flow } from './flow-contracts.js';
import type { Control } from './control-contracts.js';
import type { Decorator } from './decorator-contracts.js';
import { Data } from '../../model/calm.js';
import type { StoredNodePosition } from '../services/node-position-service.js';

//These types and interfaces are used in the top-level visualizer components e.g. Drawer, Sidebar, ReactFlowVisualizer.

/**
 * Props for Drawer component
 */
export interface DrawerProps {
    data?: Data;
    onItemSelect?: (item: SelectedItem) => void;
    decorators?: Decorator[];
    /**
     * Overrides Drawer's own `${data.name}/${data.id}` viewport key computation.
     * Used by DiagramSection to key the graph off a slug's *resolved numeric*
     * architecture id instead of the raw slug, so the same architecture reached
     * via a slug route and a numeric route share one localStorage scratch entry
     * and one server layout call. Falls back to Drawer's own computation
     * (unchanged behaviour) while the id is still resolving, and for patterns
     * and dropped files, which never receive an override.
     */
    viewportKeyOverride?: string;
    /** Server-stored default layout for an architecture. undefined = loading, null = none stored. */
    defaultLayout?: StoredNodePosition[] | null;
    /** Bumped to force a clean re-apply of positions (used by "reset to default"). */
    layoutEpoch?: number;
    /** Reports the current on-screen positions upward so they can be saved as the default. */
    onPositionsChange?: (positions: StoredNodePosition[]) => void;
}

/**
 * Selected item from graph - raw CALM node or relationship data
 */
export type SelectedItem = {
    data: CalmNodeSchema | CalmRelationshipSchema;
} | null;

/**
 * Props for Sidebar component
 */
export interface SidebarProps {
    selectedData: CalmNodeSchema | CalmRelationshipSchema;
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
    /** Identifies the diagram (namespace/id) so its viewport can be remembered. */
    viewportKey?: string;
    /** Server-stored default layout for an architecture. undefined = loading, null = none stored. */
    defaultLayout?: StoredNodePosition[] | null;
    /** Bumped to force a clean re-apply of positions (used by "reset to default"). */
    layoutEpoch?: number;
    /** Reports the current on-screen positions upward so they can be saved as the default. */
    onPositionsChange?: (positions: StoredNodePosition[]) => void;
}

/**
 * Props for ArchitectureGraph component
 */
export interface ArchitectureGraphProps {
    jsonData: CalmArchitectureSchema;
    onNodeClick?: (node: CalmNodeSchema) => void;
    onEdgeClick?: (edge: CalmRelationshipSchema) => void;
    /** Identifies the diagram (namespace/id) so its viewport can be remembered. */
    viewportKey?: string;
    /** Server-stored default layout for an architecture. undefined = loading, null = none stored. */
    defaultLayout?: StoredNodePosition[] | null;
    /** Bumped to force a clean re-apply of positions (used by "reset to default"). */
    layoutEpoch?: number;
    /** Reports the current on-screen positions upward so they can be saved as the default. */
    onPositionsChange?: (positions: StoredNodePosition[]) => void;
}

/**
 * Props for MetadataPanel component
 */
export interface MetadataPanelProps {
    flows: Flow[];
    controls: Record<string, Control>;
    decorators: Decorator[];
    adrs: string[];
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
export type MetadataPanelTabType = 'flows' | 'controls' | 'deployment' | 'adrs';

/**
 * Props for AdrsPanel component
 */
export interface AdrsPanelProps {
    adrs: string[];
}
