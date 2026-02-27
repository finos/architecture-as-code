/**
 * Re-export all contracts for backward compatibility and convenience
 */
export type NodeData = {
    'unique-id': string;
    'node-type': string;
    description?: string;
    name?: string;
    interfaces?: CalmInterfaceSchema[];
    controls?: CalmControlsSchema;
    [key: string]: unknown;
};

/**
 * Data structure for edge/relationship details displayed in the Sidebar
 * Compatible with relationship data passed from ReactFlow
 */
export type EdgeData = {
    'unique-id': string;
    'relationship-type'?: unknown;
    description?: string;
    protocol?: string;
    controls?: CalmControlsSchema;
    [key: string]: unknown;
};
export type { NodeData } from './node-contracts.js';
export type {
    EdgeData,
    EdgeControl,
    Mitigation,
    Risk,
    EdgeBadgeStyle,
    EdgeBadgeProps,
    EdgeTooltipProps,
    FlowTransitionEdge,
} from './edge-contracts.js';
export type {
    RiskItem,
    MitigationItem,
    ControlItem,
} from './node-contracts.js';
export type {
    Flow,
    FlowTransition,
    AIGFGovernance,
    FlowsPanelProps,
} from './flow-contracts.js';
export type {
    Control,
    ControlRequirement,
    ControlRequirementConfig,
    ControlsPanelProps,
} from './control-contracts.js';
export type {
    DrawerProps,
    SelectedItem,
    SidebarProps,
    ReactFlowVisualizerProps,
    ArchitectureGraphProps,
    MetadataPanelProps,
    MetadataPanelTabType,
} from './visualizer-contracts.js';
export type {
    ControlsPanelHeaderProps,
    ControlCardProps,
    ControlCardHeaderProps,
    NodeBadgeProps,
    RequirementsSectionProps,
    AIGFMappingSectionProps,
    ControlRequirementItemProps,
    ConfigSectionProps,
    AppliesToSectionProps,
} from './controls-panel-contracts.js';
export type {
    FlowsPanelHeaderProps,
    FlowCardProps,
    FlowCardHeaderProps,
    TransitionsListProps,
    FlowTransitionItemProps,
    TransitionContentProps,
    AIGFGovernanceSectionProps,
} from './flows-panel-contracts.js';
