import { CalmInterfaceSchema, CalmControlsSchema } from '@finos/calm-models/types';

/**
 * Data structure for node details displayed in the Sidebar
 * Compatible with CalmNodeSchema data passed from ReactFlow
 */
export type NodeData = {
    id: string;
    description?: string;
    type: string;
    name?: string;
    interfaces?: CalmInterfaceSchema[];
    controls?: CalmControlsSchema;
    [key: string]: unknown;
};

/**
 * AIGF risk item - all fields optional as CALM data may have partial info
 */
export interface RiskItem {
    id?: string;
    name?: string;
    description?: string;
}

/**
 * AIGF mitigation item - all fields optional as CALM data may have partial info
 */
export interface MitigationItem {
    id?: string;
    name?: string;
    description?: string;
}

/**
 * Control item - flexible structure to accommodate various control types
 */
export interface ControlItem {
    description?: string;
    [key: string]: unknown;
}
