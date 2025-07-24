import { CalmMetadata } from './metadata.js';
import { CalmControl } from './control.js';
import {
    CalmComposedOfRelationshipSchema,
    CalmConnectsRelationshipSchema, CalmDecisionSchema, CalmDeployedInRelationshipSchema,
    CalmInteractsRelationshipSchema,
    CalmOptionsRelationshipSchema,
    CalmRelationshipSchema,
    CalmRelationshipTypeSchema
} from '../types/core-types.js';
import { CalmNodeInterface } from './interface.js';


export class CalmRelationship {
    constructor(
        public uniqueId: string,
        public relationshipType: CalmRelationshipType,
        public metadata: CalmMetadata,
        public controls: CalmControl[],
        public additionalProperties: Record<string, unknown>,
        public description?: string,
        public protocol?: string
    ) { }

    static fromJson(data: CalmRelationshipSchema): CalmRelationship {
        const {
            'unique-id': uniqueId,
            'description': description,
            'relationship-type': relationshipType,
            'protocol': protocol,
            'metadata': metadata,
            'controls': controls,
            ...additionalProperties } = data;
        return new CalmRelationship(
            uniqueId,
            CalmRelationship.deriveRelationshipType(relationshipType),
            metadata ? CalmMetadata.fromJson(metadata) : new CalmMetadata({}),
            CalmControl.fromJson(controls),
            additionalProperties,
            description,
            protocol
        );
    }

    static deriveRelationshipType(data: CalmRelationshipTypeSchema): CalmRelationshipType {
        if (data.interacts) {
            return CalmInteractsType.fromJson(data.interacts);
        } else if (data.connects) {
            return CalmConnectsType.fromJson(data.connects);
        } else if (data['deployed-in']) {
            return CalmDeployedInType.fromJson(data['deployed-in']);
        } else if (data['composed-of']) {
            return CalmComposedOfType.fromJson(data['composed-of']);
        } else if (data.options) {
            return CalmOptionsRelationshipType.fromJson(data.options);
        } else {
            throw new Error('Invalid relationship type data');
        }
    }
}

export abstract class CalmRelationshipType { }

export class CalmInteractsType extends CalmRelationshipType {
    constructor(public actor: string, public nodes: string[]) {
        super();
    }

    static fromJson(data: CalmInteractsRelationshipSchema): CalmInteractsType {
        return new CalmInteractsType(data.actor, data.nodes);
    }
}

export class CalmConnectsType extends CalmRelationshipType {
    constructor(public source: CalmNodeInterface, public destination: CalmNodeInterface) {
        super();
    }

    static fromJson(data: CalmConnectsRelationshipSchema): CalmConnectsType {
        return new CalmConnectsType(
            CalmNodeInterface.fromJson(data.source),
            CalmNodeInterface.fromJson(data.destination)
        );
    }
}

export class CalmDeployedInType extends CalmRelationshipType {
    constructor(public container: string, public nodes: string[]) {
        super();
    }

    static fromJson(data: CalmDeployedInRelationshipSchema): CalmDeployedInType {
        return new CalmDeployedInType(data.container, data.nodes);
    }
}

export class CalmComposedOfType extends CalmRelationshipType {
    constructor(public container: string, public nodes: string[]) {
        super();
    }

    static fromJson(data: CalmComposedOfRelationshipSchema): CalmComposedOfType {
        return new CalmComposedOfType(data.container, data.nodes);
    }
}

export class CalmDecisionType {
    constructor(public description: string, public nodes: string[], public relationships: string[], public controls?: string[], public metadata?: string[]) { }

    static fromJson(data: CalmDecisionSchema) {
        return new CalmDecisionType(data.description, data.nodes, data.relationships, data.controls, data.metadata);
    }
}

export class CalmOptionsRelationshipType extends CalmRelationshipType {
    constructor(public decisions: CalmDecisionType[]) {
        super();
    }

    static fromJson(data: CalmOptionsRelationshipSchema): CalmOptionsRelationshipType {
        return new CalmOptionsRelationshipType(data.map(calmDecisionData => CalmDecisionType.fromJson(calmDecisionData)));
    }
}
