import { CalmMetadata } from './metadata.js';
import { CalmControls} from './control.js';
import { CalmNodeInterface } from './interface.js';
import {
    CalmComposedOfRelationshipSchema,
    CalmConnectsRelationshipSchema,
    CalmDecisionSchema,
    CalmDeployedInRelationshipSchema,
    CalmInteractsRelationshipSchema,
    CalmOptionsRelationshipSchema,
    CalmRelationshipSchema,
    CalmRelationshipTypeSchema
} from '../types/core-types.js';
import { CalmAdaptable } from './adaptable.js';
import {CalmRelationshipCanonicalModel, CalmRelationshipTypeCanonicalModel, CalmDecisionCanonicalModel} from '../canonical/template-models.js';

export class CalmRelationship
implements CalmAdaptable<CalmRelationshipSchema, CalmRelationshipCanonicalModel> {

    constructor(
        public originalJson: CalmRelationshipSchema,
        public uniqueId: string,
        public relationshipType: CalmRelationshipType,
        public metadata?: CalmMetadata,
        public controls?: CalmControls,
        public additionalProperties?: Record<string, unknown>,
        public description?: string,
        public protocol?: string
    ) {}

    toCanonicalSchema(): CalmRelationshipCanonicalModel {
        return {
            'unique-id': this.uniqueId,
            'relationship-type': this.relationshipType.toCanonicalSchema(),
            'metadata': this.metadata ? this.metadata.toCanonicalSchema() : undefined,
            'controls': this.controls ? this.controls.toCanonicalSchema() : undefined,
            'description': this.description,
            'protocol': this.protocol,
            ...this.additionalProperties
        };
    }

    toSchema(): CalmRelationshipSchema {
        return this.originalJson;
    }

    static fromSchema(schema: CalmRelationshipSchema): CalmRelationship {
        const {
            'unique-id': uniqueId,
            'description': description,
            'relationship-type': relationshipType,
            'protocol': protocol,
            'metadata': metadata,
            'controls': controls,
            ...additionalProps
        } = schema;

        return new CalmRelationship(
            schema,
            uniqueId,
            CalmRelationshipType.deriveSchema(relationshipType),
            metadata ? CalmMetadata.fromSchema(metadata) : undefined,
            controls ? CalmControls.fromSchema(controls) : undefined,
            additionalProps,
            description,
            protocol
        );
    }

}

export abstract class CalmRelationshipType {
    public abstract readonly kind: string;
    static deriveSchema(schema: CalmRelationshipTypeSchema): CalmRelationshipType {
        if (schema.interacts) return CalmInteractsType.fromSchema(schema.interacts);
        if (schema.connects) return CalmConnectsType.fromSchema(schema.connects);
        if (schema['deployed-in']) return CalmDeployedInType.fromSchema(schema['deployed-in']);
        if (schema['composed-of']) return CalmComposedOfType.fromSchema(schema['composed-of']);
        if (schema.options) return CalmOptionsRelationshipType.fromSchema(schema.options);
        throw new Error('Unknown relationship-type schema');
    }

    abstract toCanonicalSchema(): CalmRelationshipTypeCanonicalModel;

}

export class CalmInteractsType extends CalmRelationshipType
    implements CalmAdaptable<CalmInteractsRelationshipSchema, CalmRelationshipTypeCanonicalModel> {
    public readonly kind = 'interacts';

    constructor(
        public originalJson: CalmInteractsRelationshipSchema,
        public actor: string,
        public nodes: string[]
    ) {
        super();
    }

    toCanonicalSchema(): CalmRelationshipTypeCanonicalModel {
        return { interacts: { actor: this.actor, nodes: this.nodes }};
    }

    static fromSchema(schema: CalmInteractsRelationshipSchema): CalmInteractsType {
        return new CalmInteractsType(schema, schema.actor, schema.nodes);
    }

    toSchema(): CalmInteractsRelationshipSchema {
        return this.originalJson;
    }
}

export class CalmConnectsType extends CalmRelationshipType
    implements CalmAdaptable<CalmConnectsRelationshipSchema, CalmRelationshipTypeCanonicalModel> {

    public readonly kind = 'connects';

    constructor(
        public originalJson: CalmConnectsRelationshipSchema,
        public source: CalmNodeInterface,
        public destination: CalmNodeInterface
    ) {
        super();
    }

    toCanonicalSchema(): CalmRelationshipTypeCanonicalModel {
        return { connects: { source: this.source.toCanonicalSchema(), destination: this.destination.toCanonicalSchema() }};
    }

    static fromSchema(schema: CalmConnectsRelationshipSchema): CalmConnectsType {
        return new CalmConnectsType(
            schema,
            CalmNodeInterface.fromSchema(schema.source),
            CalmNodeInterface.fromSchema(schema.destination)
        );
    }

    toSchema(): CalmConnectsRelationshipSchema {
        return this.originalJson;
    }
}

export class CalmDeployedInType extends CalmRelationshipType
    implements CalmAdaptable<CalmDeployedInRelationshipSchema, CalmRelationshipTypeCanonicalModel>{
    public readonly kind = 'deployed-in';

    constructor(
        public originalJson: CalmDeployedInRelationshipSchema,
        public container: string,
        public nodes: string[]
    ) {
        super();
    }

    toCanonicalSchema(): CalmRelationshipTypeCanonicalModel {
        return { 'deployed-in': { container: this.container, nodes: this.nodes }};
    }

    static fromSchema(schema: CalmDeployedInRelationshipSchema): CalmDeployedInType {
        return new CalmDeployedInType(schema, schema.container, schema.nodes);
    }

    toSchema(): CalmDeployedInRelationshipSchema {
        return this.originalJson;
    }
}

export class CalmComposedOfType extends CalmRelationshipType
    implements CalmAdaptable<CalmComposedOfRelationshipSchema, CalmRelationshipTypeCanonicalModel>{
    public readonly kind = 'composed-of';
    constructor(
        public originalJson: CalmComposedOfRelationshipSchema,
        public container: string,
        public nodes: string[]
    ) {
        super();
    }

    toCanonicalSchema(): CalmRelationshipTypeCanonicalModel {
        return { 'composed-of': { container: this.container, nodes: this.nodes }};
    }

    static fromSchema(schema: CalmComposedOfRelationshipSchema): CalmComposedOfType {
        return new CalmComposedOfType(schema, schema.container, schema.nodes);
    }

    toSchema(): CalmComposedOfRelationshipSchema {
        return this.originalJson;
    }
}

export class CalmDecisionType
implements CalmAdaptable<CalmDecisionSchema, CalmDecisionCanonicalModel> {
    constructor(
        public originalJson: CalmDecisionSchema,
        public description: string,
        public nodes: string[],
        public relationships: string[],
        public controls?: string[],
        public metadata?: string[]
    ) {}

    toCanonicalSchema(): CalmDecisionCanonicalModel {
        return {
            'description': this.description,
            'nodes': this.nodes,
            'relationships': this.relationships,
            'controls': this.controls ?? [],
            'metadata': this.metadata ?? []
        };
    }

    static fromSchema(schema: CalmDecisionSchema): CalmDecisionType {
        return new CalmDecisionType(
            schema,
            schema.description,
            schema.nodes,
            schema.relationships,
            schema.controls,
            schema.metadata
        );
    }

    toSchema(): CalmDecisionSchema {
        return this.originalJson;
    }
}

export class CalmOptionsRelationshipType extends CalmRelationshipType
    implements CalmAdaptable<CalmOptionsRelationshipSchema, CalmRelationshipTypeCanonicalModel> {
    public readonly kind = 'options';

    constructor(
        public originalJson: CalmOptionsRelationshipSchema,
        public options: CalmDecisionType[]
    ) {
        super();
    }

    toCanonicalSchema(): CalmRelationshipTypeCanonicalModel {
        return {
            'options': this.options.map(option => option.toCanonicalSchema())
        };
    }

    static fromSchema(schema: CalmOptionsRelationshipSchema): CalmOptionsRelationshipType {
        const decisions = schema.map(CalmDecisionType.fromSchema);
        return new CalmOptionsRelationshipType(schema, decisions);
    }

    toSchema(): CalmOptionsRelationshipSchema {
        return this.originalJson;
    }
}
