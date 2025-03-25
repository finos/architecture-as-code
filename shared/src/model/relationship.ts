import { CalmMetadata } from './metadata.js';
import { CalmControl } from './control.js';
import {
    CalmComposedOfRelationshipSchema,
    CalmConnectsRelationshipSchema, CalmDeployedInRelationshipSchema,
    CalmInteractsRelationshipSchema,
    CalmOptionsRelationshipSchema,
    CalmOptionsTypeSchema,
    CalmRelationshipSchema,
    CalmRelationshipTypeSchema
} from '../types/core-types.js';
import {CalmNodeInterface} from './interface.js';


export class CalmRelationship {
    constructor(
        public uniqueId: string,
        public relationshipType: CalmRelationshipType,
        public metadata: CalmMetadata,
        public controls: CalmControl[],
        public description?: string,
        public protocol?: string ,
        public authentication?: string
   
    ) {}

    static fromJson(data: CalmRelationshipSchema): CalmRelationship {
        return new CalmRelationship(
            data['unique-id'],
            CalmRelationship.deriveRelationshipType(data['relationship-type']),
            data.metadata ? CalmMetadata.fromJson(data.metadata) : new CalmMetadata({}),
            CalmControl.fromJson(data.controls),
            data.description,
            data.protocol,
            data.authentication
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

export abstract class CalmRelationshipType {}

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

export class CalmOptionsType {
    constructor(public description: string, public nodes: string[], public relationships: string[]) {}

    static fromJson(data: CalmOptionsTypeSchema) {
        return new CalmOptionsType(data.description, data.nodes, data.relationships);
    }
}

export class CalmOptionsRelationshipType extends CalmRelationshipType {
    constructor(public options: CalmOptionsType[]) {
        super();
    }

    static fromJson(data: CalmOptionsRelationshipSchema): CalmOptionsRelationshipType {
        return new CalmOptionsRelationshipType(data.map(calmOptionData => CalmOptionsType.fromJson(calmOptionData)));
    }
}
