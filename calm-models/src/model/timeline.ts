import { CalmAdaptable } from './adaptable.js';
import { CalmMetadata } from './metadata.js';
import { CalmMoment } from './moment.js';
import { CalmTimelineSchema } from '../types';
import { CalmTimelineCanonicalModel } from '../canonical/template-models.js';

export type Timeline = CalmTimeline

export class CalmTimeline implements CalmAdaptable<CalmTimelineSchema, CalmTimelineCanonicalModel> {
    constructor(
        public originalJson: CalmTimelineSchema,
        public moments: CalmMoment[] = [],
        public metadata?: CalmMetadata,
        public currentMoment?: string
    ) {}

    toCanonicalSchema(): CalmTimelineCanonicalModel {
        return {
            moments: this.moments.map(moment => moment.toCanonicalSchema()),
            metadata: this.metadata ? this.metadata.toCanonicalSchema() : undefined,
            "current-moment": this.currentMoment ? this.currentMoment : undefined
        };
    }

    static fromSchema(schema: CalmTimelineSchema): CalmTimeline {
        return new CalmTimeline(
            schema,
            schema.moments.map(CalmMoment.fromSchema),
            schema.metadata ? CalmMetadata.fromSchema(schema.metadata) : undefined,
            schema["current-moment"]
        );
    }

    toSchema(): CalmTimelineSchema {
        return this.originalJson;
    }
}
