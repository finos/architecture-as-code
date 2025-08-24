import {CalmControlsSchema} from './control-types.js';
import {CalmMetadataSchema} from './metadata-types.js';

export type CalmFlowTransitionDirectionSchema =  'source-to-destination' | 'destination-to-source';

export type CalmFlowTransitionSchema = {
    'relationship-unique-id': string;
    'sequence-number': number;
    description: string;
    direction?: CalmFlowTransitionDirectionSchema;
};

export type CalmFlowSchema = {
    'unique-id': string;
    name: string;
    description: string;
    'requirement-url'?: string;
    transitions: CalmFlowTransitionSchema[];
    controls?: CalmControlsSchema;
    metadata?: CalmMetadataSchema;
};
