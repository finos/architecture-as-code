import type { Control, ControlRequirement } from './control-contracts.js';

/**
 * Props for ControlsPanelHeader component
 */
export interface ControlsPanelHeaderProps {
    controlCount: number;
}

/**
 * Props for ControlCard component
 */
export interface ControlCardProps {
    controlId: string;
    control: Control;
    onNodeClick?: (nodeId: string) => void;
    onControlClick?: (controlId: string) => void;
}

/**
 * Props for ControlCard header sub-component
 */
export interface ControlCardHeaderProps {
    controlId: string;
    control: Control;
    onNodeClick?: (nodeId: string) => void;
}

/**
 * Props for NodeBadge sub-component
 */
export interface NodeBadgeProps {
    nodeName: string;
    nodeId?: string;
    onClick?: (nodeId: string) => void;
}

/**
 * Props for RequirementsSection sub-component
 */
export interface RequirementsSectionProps {
    requirements: NonNullable<Control['requirements']>;
    onNodeClick?: (nodeId: string) => void;
}

/**
 * Props for AIGFMappingSection component
 */
export interface AIGFMappingSectionProps {
    mitigations?: string[];
    risks?: string[];
}

/**
 * Props for ControlRequirementItem component
 */
export interface ControlRequirementItemProps {
    requirement: ControlRequirement;
    onNodeClick?: (nodeId: string) => void;
}

/**
 * Props for ConfigSection sub-component
 */
export interface ConfigSectionProps {
    config: NonNullable<ControlRequirement['config']>;
    onNodeClick?: (nodeId: string) => void;
}

/**
 * Props for AppliesToSection sub-component
 */
export interface AppliesToSectionProps {
    appliesTo: NonNullable<NonNullable<ControlRequirement['config']>['appliesTo']>;
    onNodeClick?: (nodeId: string) => void;
}
