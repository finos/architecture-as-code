import { CalmControlsSchema } from './types/control-types';
import {
    CalmAuthenticationSchema,
    CalmProtocolSchema,
} from './types/core-types';
import { CalmMetadataSchema } from './types/metadata-types';

export interface CALMInteractsRelationship {
    'relationship-type': {
        interacts: {
            actor: string;
            nodes: string[];
        };
    };
    ['unique-id']: string;
    description?: string;
}

export interface CALMConnectsRelationship {
    'relationship-type': {
        connects: {
            source: { node: string; interfaces: string[] };
            destination: { node: string; interfaces: string[] };
        };
    };
    ['unique-id']: string;
    description?: string;
    protocol?: CalmProtocolSchema;
    authentication?: CalmAuthenticationSchema;
    metadata?: CalmMetadataSchema;
    controls?: CalmControlsSchema;
}

export interface CALMDeployedInRelationship {
    'relationship-type': {
        'deployed-in': {
            container: string;
            nodes: string[];
        };
    };
    ['unique-id']: string;
    description?: string;
}

export interface CALMComposedOfRelationship {
    'relationship-type': {
        'composed-of': {
            container: string;
            nodes: string[];
        };
    };
    ['unique-id']: string;
    description?: string;
}
