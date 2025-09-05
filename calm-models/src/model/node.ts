import { CalmInterface } from './interface.js';
import { CalmControls } from './control.js';
import { CalmMetadata } from './metadata.js';
import { CalmCore } from './core.js';
import {ResolvableAndAdaptable} from './resolvable.js';
import {
    CalmCoreSchema,
    CalmNodeDetailsSchema,
    CalmNodeSchema
} from '../types';
import {CalmAdaptable, NullSchema} from './adaptable.js';
import {CalmNodeCanonicalModel} from '../canonical/template-models.js';

export type CalmNodeType =
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

export class CalmNodeDetails implements CalmAdaptable<CalmNodeDetailsSchema, NullSchema> {
    constructor(
        public originalJson: CalmNodeDetailsSchema,
        public requiredPattern?: ResolvableAndAdaptable<CalmCoreSchema,CalmCore>,
        public detailedArchitecture?: ResolvableAndAdaptable<CalmCoreSchema,CalmCore>
    ) {}

    toCanonicalSchema(): NullSchema {
        throw new Error('This should not partake or be called in the canonical form');
    }

    static fromSchema(schema: CalmNodeDetailsSchema): CalmNodeDetails {
        return new CalmNodeDetails(
            schema,
            schema['required-pattern'] ? new ResolvableAndAdaptable<CalmCoreSchema,CalmCore>(schema['required-pattern'], CalmCore.fromSchema) : undefined,
            schema['detailed-architecture'] ? new ResolvableAndAdaptable<CalmCoreSchema, CalmCore>(schema['detailed-architecture'], CalmCore.fromSchema) : undefined
        );
    }

    toSchema(): CalmNodeDetailsSchema {
        return this.originalJson;
    }
}

export class CalmNode implements CalmAdaptable<CalmNodeSchema, CalmNodeCanonicalModel> {
    constructor(
        public originalJson: CalmNodeSchema,
        public uniqueId: string,
        public nodeType: CalmNodeType,
        public name: string,
        public description: string,
        public details?: CalmNodeDetails,
        public interfaces?: CalmInterface[],
        public controls?: CalmControls,
        public metadata?: CalmMetadata,
        public additionalProperties?: Record<string, unknown>
    ) {}

    toCanonicalSchema(): CalmNodeCanonicalModel {
        const details = this.details?.detailedArchitecture?.isResolved
            ? this.details.detailedArchitecture.value.toCanonicalSchema()
            : undefined;

        return {
            'unique-id': this.uniqueId,
            'node-type': this.nodeType,
            name: this.name,
            description: this.description,
            details: details,
            interfaces: this.interfaces ? this.interfaces.map(i => i.toCanonicalSchema()) : undefined,
            controls: this.controls ? this.controls.toCanonicalSchema() : undefined,
            metadata: this.metadata ? this.metadata.toCanonicalSchema() : undefined,
            additionalProperties: this.additionalProperties || undefined
        };
    }

    static fromSchema(schema: CalmNodeSchema): CalmNode {
        const {
            'unique-id': uniqueId,
            'node-type': nodeType,
            name,
            description,
            details,
            interfaces,
            controls,
            metadata,
            ...additional
        } = schema;

        return new CalmNode(
            schema,
            uniqueId,
            nodeType,
            name,
            description,
            details ? CalmNodeDetails.fromSchema(details) : undefined,
            interfaces? interfaces.map(CalmInterface.fromSchema) : undefined,
            controls? CalmControls.fromSchema(controls): undefined,
            metadata ? CalmMetadata.fromSchema(metadata) : undefined,
            Object.keys(additional).length > 0 ? additional : undefined
        );
    }

    toSchema(): CalmNodeSchema {
        return this.originalJson;
    }
}
