import {
    CalmContainerImageInterfaceSchema,
    CalmHostnameInterfaceSchema,
    CalmHostPortInterfaceSchema,
    CalmInterfaceTypeSchema,
    CalmNodeInterfaceSchema,
    CalmOAuth2AudienceInterfaceSchema,
    CalmPathInterfaceSchema,
    CalmPortInterfaceSchema,
    CalmRateLimitInterfaceSchema,
    CalmURLInterfaceSchema,
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
    | 'data-asset';
export type CalmDataClassificationSchema =
    | 'Public'
    | 'Confidential'
    | 'Highly Restricted'
    | 'MNPI'
    | 'PII';
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
export type CalmAuthenticationSchema =
    | 'Basic'
    | 'OAuth2'
    | 'Kerberos'
    | 'SPNEGO'
    | 'Certificate';

export type CalmNodeDetailsSchema = {
    'detailed-architecture': string;
    'required-pattern': string;
};

export type CalmNodeSchema = {
    'unique-id': string;
    'node-type': CalmNodeTypeSchema;
    name: string;
    description: string;
    details?: CalmNodeDetailsSchema;
    'data-classification'?: CalmDataClassificationSchema;
    'run-as'?: string;
    interfaces?: (
        | CalmInterfaceTypeSchema
        | CalmHostPortInterfaceSchema
        | CalmHostnameInterfaceSchema
        | CalmPathInterfaceSchema
        | CalmOAuth2AudienceInterfaceSchema
        | CalmURLInterfaceSchema
        | CalmRateLimitInterfaceSchema
        | CalmContainerImageInterfaceSchema
        | CalmPortInterfaceSchema
    )[];
    controls?: CalmControlsSchema;
    metadata?: CalmMetadataSchema;
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

export type CalmOptionTypeSchema = {
    description: string;
    nodes: string[];
    relationships: string[];
};

export type CalmOptionsRelationshipSchema = CalmOptionTypeSchema[];

export type CalmRelationshipTypeSchema = {
    interacts?: CalmInteractsRelationshipSchema;
    connects?: CalmConnectsRelationshipSchema;
    'deployed-in'?: CalmDeployedInRelationshipSchema;
    'composed-of'?: CalmComposedOfRelationshipSchema;
    options?: CalmOptionsRelationshipSchema;
};

export type CalmRelationshipSchema = {
    'unique-id': string;
    description?: string;
    'relationship-type': CalmRelationshipTypeSchema;
    protocol?: CalmProtocolSchema;
    authentication?: CalmAuthenticationSchema;
    metadata?: CalmMetadataSchema;
    controls?: CalmControlsSchema;
};

//TODO: There is no required section.
export type CalmCoreSchema = {
    nodes?: CalmNodeSchema[];
    relationships?: CalmRelationshipSchema[];
    metadata?: CalmMetadataSchema;
    controls?: CalmControlsSchema;
    flows?: CalmFlowSchema[];
};

export interface CalmSchema {}

export type CalmArchitectureSchema = CalmCoreSchema;
export type CalmPatternSchema = CalmCoreSchema;
