import { CalmInterface } from './interface.js';
import { CalmControl } from './control.js';
import { CalmMetadata } from './metadata.js';
import { CalmNodeDetailsSchema, CalmNodeSchema } from '../types/core-types.js';

export type CalmNodeType = 'actor' | 'ecosystem' | 'system' | 'service' | 'database' | 'network' | 'ldap' | 'webclient' | 'data-asset' | string;

export class CalmNodeDetails {
    constructor(
        public detailedArchitecture: string,
        public requiredPattern: string
    ) { }
    static fromJson(data: CalmNodeDetailsSchema): CalmNodeDetails {
        return new CalmNodeDetails(
            data['detailed-architecture'],
            data['required-pattern']
        );
    }
}


export class CalmNode {
    constructor(
        public uniqueId: string,
        public nodeType: CalmNodeType,
        public name: string,
        public description: string,
        public details: CalmNodeDetails,
        public interfaces: CalmInterface[],
        public controls: CalmControl[],
        public metadata: CalmMetadata,
        public additionalProperties: Record<string, unknown>
    ) { }

    static fromJson(data: CalmNodeSchema): CalmNode {
        const {
            'unique-id': uniqueId,
            'node-type': nodeType,
            'name': name,
            'description': description,
            'details': details,
            interfaces,
            controls,
            metadata,
            ...additionalProperties } = data;
        return new CalmNode(
            uniqueId,
            nodeType,
            name,
            description,
            details ? CalmNodeDetails.fromJson(details) : new CalmNodeDetails('', ''),
            interfaces ? data.interfaces.map(CalmInterface.fromJson) : [],
            controls ? CalmControl.fromJson(controls) : [],
            metadata ? CalmMetadata.fromJson(metadata) : new CalmMetadata({}),
            additionalProperties
        );
    }
}
