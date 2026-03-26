import type { AIGFGovernance, Flow, FlowTransition } from './flow-contracts.js';

//These types and interfaces are used in the flows panel.

/**
 * Props for FlowsPanelHeader component
 */
export interface FlowsPanelHeaderProps {
    flowCount: number;
}

/**
 * Props for FlowCard component
 */
export interface FlowCardProps {
    flow: Flow;
    onTransitionClick?: (relationshipId: string) => void;
}

/**
 * Props for FlowCard header sub-component
 */
export interface FlowCardHeaderProps {
    name: string;
    description?: string;
}

/**
 * Props for TransitionsList sub-component
 */
export interface TransitionsListProps {
    transitions?: Flow['transitions'];
    onTransitionClick?: (relationshipId: string) => void;
}

/**
 * Props for FlowTransitionItem component
 */
export interface FlowTransitionItemProps {
    transition: FlowTransition;
    onClick?: (relationshipId: string) => void;
}

/**
 * Props for TransitionContent sub-component
 */
export interface TransitionContentProps {
    description?: string;
    relationshipId: string;
}

/**
 * Props for AIGFGovernanceSection component
 */
export interface AIGFGovernanceSectionProps {
    governance: AIGFGovernance;
}
