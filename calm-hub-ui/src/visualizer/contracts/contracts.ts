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
 * Data structure for edge/relationship details displayed in the Sidebar
 * Compatible with relationship data passed from ReactFlow
 */
export type EdgeData = {
    id: string;
    label?: string;
    source: string;
    target: string;
    description?: string;
    protocol?: string;
    controls?: CalmControlsSchema;
    [key: string]: unknown;
};
