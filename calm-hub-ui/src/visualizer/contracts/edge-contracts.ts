import { CalmControlsSchema } from '@finos/calm-models/types';

/**
 * Flow transition for an edge
 */
export interface FlowTransitionEdge {
    sequence: number;
    flowName?: string;
    description?: string;
}

/**
 * Control applied to an edge
 */
export interface EdgeControl {
    description?: string;
}

/**
 * Mitigation item for AIGF edge data
 */
export interface Mitigation {
    id?: string;
    name?: string;
}

/**
 * Risk item for AIGF edge data
 */
export interface Risk {
    id?: string;
    name?: string;
}

/**
 * Edge data from CALM relationships - all fields optional as different
 * relationship types have different data (connects, interacts, etc.)
 */
export interface EdgeData {
    id: string;
    label?: string;
    source: string;
    target: string;
    description?: string;
    protocol?: string;
    direction?: 'forward' | 'backward';
    flowTransitions?: FlowTransitionEdge[];
    controls?: CalmControlsSchema;
    metadata?: {
        aigf?: {
            'controls-applied'?: string[];
            mitigations?: (string | Mitigation)[];
            risks?: (string | Risk)[];
        };
    };
    [key: string]: unknown;
}

/**
 * Style for edge badges
 */
export interface EdgeBadgeStyle {
    background: string;
    border: string;
    iconColor: string;
}

/**
 * Props for EdgeBadge component
 */
export interface EdgeBadgeProps {
    hasFlowInfo: boolean;
    hasAIGF: boolean;
    badgeStyle: EdgeBadgeStyle;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

/**
 * Props for EdgeTooltip component
 */
export interface EdgeTooltipProps {
    description: string;
    protocol?: string;
    direction?: string;
    flowTransitions: FlowTransitionEdge[];
    edgeControls: Record<string, EdgeControl>;
    controlsApplied: string[];
    mitigations: (string | Mitigation)[];
    risks: (string | Risk)[];
    labelX: number;
    labelY: number;
}
