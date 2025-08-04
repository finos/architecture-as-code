import { Resolvable } from './resolvable.js';
import {
    CalmInterfaceDefinitionSchema,
    CalmInterfaceTypeSchema,
    CalmNodeInterfaceSchema
} from '../types/interface-types.js';

import { CalmAdaptable } from './adaptable.js';
import {CalmInterfaceSchema} from '../types/core-types';
import {CalmInterfaceCanonicalModel, CalmNodeInterfaceCanonicalModel} from '../template/template-models';

export abstract class CalmInterface {
    protected constructor(public uniqueId: string) {}

    static fromSchema(schema: CalmInterfaceSchema): CalmInterface {
        const keys = Object.keys(schema).sort();
        const isDefinition = ['config', 'definition-url', 'unique-id'].every(k => keys.includes(k));

        return isDefinition
            ? CalmInterfaceDefinition.fromSchema(schema as CalmInterfaceDefinitionSchema)
            : CalmInterfaceType.fromSchema(schema as CalmInterfaceTypeSchema);
    }

    abstract toCanonicalSchema(): CalmInterfaceCanonicalModel;


}

export class CalmInterfaceDefinition
    extends CalmInterface
    implements CalmAdaptable<CalmInterfaceDefinitionSchema, CalmInterfaceCanonicalModel> {

    constructor(
        public originalJson: CalmInterfaceDefinitionSchema,
        public uniqueId: string,
        public definitionUrl: Resolvable<string>,
        public config: Record<string, unknown>
    ) {
        super(uniqueId);
    }

    toCanonicalSchema(): CalmInterfaceCanonicalModel {
        return {
            'unique-id': this.uniqueId,
            'definition-url': this.definitionUrl.reference,
            ...this.config
        };
    }

    static fromSchema(schema: CalmInterfaceDefinitionSchema): CalmInterfaceDefinition {
        return new CalmInterfaceDefinition(
            schema,
            schema['unique-id'],
            new Resolvable<string>(schema['definition-url']),
            schema.config
        );
    }

    toSchema(): CalmInterfaceDefinitionSchema {
        return this.originalJson;
    }
}

export class CalmInterfaceType
    extends CalmInterface
    implements CalmAdaptable<CalmInterfaceTypeSchema, CalmInterfaceCanonicalModel> {

    constructor(
        public originalJson: CalmInterfaceTypeSchema,
        public uniqueId: string,
        public additionalProperties: Record<string, unknown>
    ) {
        super(uniqueId);
    }

    static fromSchema(schema: CalmInterfaceTypeSchema): CalmInterfaceType {
        const { 'unique-id': uniqueId, ...additionalProperties } = schema;
        return new CalmInterfaceType(schema, uniqueId, additionalProperties);
    }

    toSchema(): CalmInterfaceTypeSchema {
        return this.originalJson;
    }

    toCanonicalSchema(): CalmInterfaceCanonicalModel {
        return this.originalJson;
    }
}

export class CalmNodeInterface
implements CalmAdaptable<CalmNodeInterfaceSchema, CalmNodeInterfaceCanonicalModel> {

    constructor(
        public originalJson: CalmNodeInterfaceSchema,
        public node: string,
        public interfaces?: string[]
    ) {}

    static fromSchema(schema: CalmNodeInterfaceSchema): CalmNodeInterface {
        return new CalmNodeInterface(schema, schema.node, schema.interfaces);
    }

    toSchema(): CalmNodeInterfaceSchema {
        return this.originalJson;
    }

    toCanonicalSchema(): CalmNodeInterfaceCanonicalModel {
        return this.originalJson; // These are currently matching schemas
    }

}
