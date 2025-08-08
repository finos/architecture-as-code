import { CalmFlowSchema, CalmFlowTransitionSchema } from '../types/flow-types';
import { CalmAdaptable } from './adaptable.js';
import {CalmFlowCanonicalModel, CalmFlowTransitionCanonicalModel} from '../template/template-models';
import {CalmControls} from './control';
import {CalmMetadata} from './metadata';

export type CalmFlowDirection = 'source-to-destination' | 'destination-to-source';

export class CalmFlowTransition implements CalmAdaptable<CalmFlowTransitionSchema, CalmFlowTransitionCanonicalModel> {
    constructor(
        public originalJson: CalmFlowTransitionSchema,
        public relationshipUniqueId: string,
        public sequenceNumber: number,
        public description: string,
        public direction: CalmFlowDirection = 'source-to-destination'
    ) {}

    toCanonicalSchema(): CalmFlowTransitionCanonicalModel {
        return {
            'relationship-unique-id': this.relationshipUniqueId,
            'sequence-number': this.sequenceNumber,
            description: this.description,
            direction: this.direction
        };
    }

    static fromSchema(schema: CalmFlowTransitionSchema): CalmFlowTransition {
        return new CalmFlowTransition(
            schema,
            schema['relationship-unique-id'],
            schema['sequence-number'],
            schema.description,
            schema.direction ?? 'source-to-destination'
        );
    }

    toSchema(): CalmFlowTransitionSchema {
        return this.originalJson;
    }
}

export class CalmFlow implements CalmAdaptable<CalmFlowSchema, CalmFlowCanonicalModel> {
    constructor(
        public originalJson: CalmFlowSchema,
        public uniqueId: string,
        public name: string,
        public description: string,
        public transitions: CalmFlowTransition[] = [],
        public requirementUrl?: string,
        public controls?: CalmControls,
        public metadata?: CalmMetadata
    ) {}

    toCanonicalSchema(): CalmFlowCanonicalModel {
        return {
            'unique-id': this.uniqueId,
            name: this.name,
            description: this.description,
            'requirement-url': this.requirementUrl,
            transitions: this.transitions.map(transition => transition.toCanonicalSchema()),
            controls: this.controls ? this.controls.toCanonicalSchema() : undefined,
            metadata: this.metadata ? this.metadata.toCanonicalSchema() : undefined
        };
    }

    static fromSchema(schema: CalmFlowSchema): CalmFlow {
        const transitions = (schema.transitions ?? []).map(CalmFlowTransition.fromSchema);
        return new CalmFlow(
            schema,
            schema['unique-id'],
            schema.name,
            schema.description,
            transitions,
            schema['requirement-url'] ?? '',
            schema.controls ? CalmControls.fromSchema(schema.controls) : undefined,
            schema.metadata ? CalmMetadata.fromSchema(schema.metadata) : undefined
        );
    }

    toSchema(): CalmFlowSchema {
        return this.originalJson;
    }
}
