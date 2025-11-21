import { CalmControls } from './control.js';
import { CalmMetadata } from './metadata.js';
import { CalmNodeDetails } from './node.js';
import { CalmMomentSchema } from '../types';
import { CalmAdaptable } from './adaptable.js';
import { CalmMomentCanonicalModel } from '../canonical/template-models.js';
import { CalmNode } from './node';

export class CalmMoment extends CalmNode implements CalmAdaptable<CalmMomentSchema, CalmMomentCanonicalModel> {
    constructor(
        public originalJson: CalmMomentSchema,
        public uniqueId: string,
        public name: string,
        public description: string,
        public validFrom?: string,
        public details?: CalmNodeDetails,
        public controls?: CalmControls,
        public metadata?: CalmMetadata,
        public adrs?: string[],
        public additionalProperties?: Record<string, unknown>
    ) {
        super(originalJson, uniqueId, 'moment', name, description, details, undefined, controls, metadata, additionalProperties);
        this.validFrom = validFrom;
        this.adrs = adrs;
    }

    toCanonicalSchema(): CalmMomentCanonicalModel {
        const moment: CalmMomentCanonicalModel = super.toCanonicalSchema();
        moment.adrs = this.adrs;
        moment['valid-from'] = this.validFrom;
        return moment;
    }

    static fromSchema(schema: CalmMomentSchema): CalmMoment {
        const {
            'unique-id': uniqueId,
            name,
            description,
            'node-type': _, // will be 'moment'
            'valid-from': validFrom,
            details,
            controls,
            metadata,
            adrs,
            ...additional
        } = schema;

        return new CalmMoment(
            schema,
            uniqueId,
            name,
            description,
            validFrom,
            CalmNodeDetails.fromSchema(details),
            controls ? CalmControls.fromSchema(controls) : undefined,
            metadata ? CalmMetadata.fromSchema(metadata) : undefined,
            adrs,
            Object.keys(additional).length > 0 ? additional : undefined
        );
    }

    toSchema(): CalmMomentSchema {
        return this.originalJson;
    }
}
