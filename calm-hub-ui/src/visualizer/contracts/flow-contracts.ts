/**
 * Flow transition for a flow
 */
export interface FlowTransition {
    'sequence-number': number;
    'relationship-unique-id': string;
    description?: string;
    direction?: string;
}

/**
 * AIGF governance data for flows
 */
export interface AIGFGovernance {
    'mitigations-applied'?: string[];
    'risks-addressed'?: string[];
    'trust-boundaries-crossed'?: string[];
}

/**
 * Flow data from CALM specification
 */
export interface Flow {
    'unique-id': string;
    name: string;
    description?: string;
    transitions?: FlowTransition[];
    'aigf-governance'?: AIGFGovernance;
}

/**
 * Props for FlowsPanel component
 */
export interface FlowsPanelProps {
    flows: Flow[];
    onTransitionClick?: (relationshipId: string) => void;
}
