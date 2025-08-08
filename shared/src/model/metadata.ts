import { CalmMetadataSchema } from '../types/metadata-types.js';
import { CalmAdaptable } from './adaptable.js';
import {CalmMetadataCanonicalModel} from '../template/template-models';

export class CalmMetadata implements CalmAdaptable<CalmMetadataSchema,CalmMetadataCanonicalModel> {
    constructor(
        public originalJson: CalmMetadataSchema,
        public data: Record<string, unknown>
    ) {}

    toSchema(): CalmMetadataSchema {
        return this.originalJson;
    }

    static fromSchema(schema: CalmMetadataSchema): CalmMetadata {
        const flattened: Record<string, unknown> = Array.isArray(schema)
            ? Object.assign({}, ...schema)
            : schema;

        return new CalmMetadata(schema, flattened);
    }

    toCanonicalSchema(): CalmMetadataCanonicalModel {
        return this.data;
    }

}
