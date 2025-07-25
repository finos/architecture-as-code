import {
    CalmInterfaceDefinitionSchema,
    CalmInterfaceTypeSchema,
    CalmNodeInterfaceSchema
} from './interface-types.js';
import { CalmControlsSchema } from './control-types.js';
import { CalmMetadataSchema } from './metadata-types.js';
import { CalmFlowSchema } from './flow-types.js';

export type CalmNodeTypeSchema =
    | 'actor'
    | 'ecosystem'
    | 'system'
    | 'service'
    | 'database'
    | 'network'
    | 'ldap'
    | 'webclient'
    | 'data-asset'
    | string;

export type CalmNodeDetailsSchema = {
    'detailed-architecture'?: string;
    'required-pattern'?: string;
};

export type CalmInterfaceSchema =
    | CalmInterfaceDefinitionSchema
    | CalmInterfaceTypeSchema;

export type CalmNodeSchema = {
    'unique-id': string;
    'node-type': CalmNodeTypeSchema;
    name: string;
    description: string;
    details?: CalmNodeDetailsSchema;
    interfaces?: CalmInterfaceSchema[];
    controls?: CalmControlsSchema;
    metadata?: CalmMetadataSchema;
    [key: string]: unknown; // Additional properties can be added
};

export type CalmInteractsRelationshipSchema = {
    actor: string;
    nodes: string[];
};

export type CalmConnectsRelationshipSchema = {
    source: CalmNodeInterfaceSchema;
    destination: CalmNodeInterfaceSchema;
};

export type CalmDeployedInRelationshipSchema = {
    container: string;
    nodes: string[];
};

export type CalmComposedOfRelationshipSchema = {
    container: string;
    nodes: string[];
};

export type CalmDecisionSchema = {
    description: string;
    nodes: string[];
    relationships: string[];
    controls?: string[];
    metadata?: string[];
};

export type CalmOptionsRelationshipSchema = CalmDecisionSchema[];

export type CalmRelationshipTypeSchema = {
    interacts?: CalmInteractsRelationshipSchema;
    connects?: CalmConnectsRelationshipSchema;
    'deployed-in'?: CalmDeployedInRelationshipSchema;
    'composed-of'?: CalmComposedOfRelationshipSchema;
    options?: CalmOptionsRelationshipSchema;
};

export type CalmProtocolSchema =
    | 'HTTP'
    | 'HTTPS'
    | 'FTP'
    | 'SFTP'
    | 'JDBC'
    | 'WebSocket'
    | 'SocketIO'
    | 'LDAP'
    | 'AMQP'
    | 'TLS'
    | 'mTLS'
    | 'TCP';

export type CalmRelationshipSchema = {
    'unique-id': string;
    description?: string;
    'relationship-type': CalmRelationshipTypeSchema;
    protocol?: CalmProtocolSchema;
    metadata?: CalmMetadataSchema;
    controls?: CalmControlsSchema;
    [key: string]: unknown;
};

export type CalmCoreSchema = {
    nodes?: CalmNodeSchema[];
    relationships?: CalmRelationshipSchema[];
    metadata?: CalmMetadataSchema;
    controls?: CalmControlsSchema;
    flows?: CalmFlowSchema[];
    adrs?: string[];
};

export type CalmArchitectureSchema = CalmCoreSchema;
export type CalmPatternSchema = CalmCoreSchema;
