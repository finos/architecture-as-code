import { CalmControlsSchema } from './control-types.js';
import { CalmMetadataSchema } from './metadata-types.js';
import { CalmNodeDetailsSchema } from './core-types.js';

export type CalmMomentSchema = {
    'unique-id': string;
    'node-type': string;
    name: string;
    description: string;
    'valid-from'?: string;
    details?: CalmNodeDetailsSchema;
    controls?: CalmControlsSchema;
    metadata?: CalmMetadataSchema;
    adrs?: string[];
    [key: string]: unknown; // Additional properties can be added
};

export type CalmTimelineSchema = {
    moments: CalmMomentSchema[];
    'current-moment'?: string;
    metadata?: CalmMetadataSchema;
};
