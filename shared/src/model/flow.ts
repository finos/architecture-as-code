import { CalmControl } from './control.js';
import { CalmMetadata } from './metadata.js';
import {CalmFlowSchema, CalmFlowTransitionSchema} from '../types/flow-types.js';

export type CalmFlowDirection = 'source-to-destination' | 'destination-to-source';

export class CalmFlow {
    constructor(
        public uniqueId: string,
        public name: string,
        public description: string,
        public transitions: CalmFlowTransition[],
        public requirementUrl: string,
        public controls: CalmControl[],
        public metadata: CalmMetadata
    ) {}

    static fromJson(data: CalmFlowSchema): CalmFlow {

        return new CalmFlow(
            data['unique-id'],
            data.name,
            data.description,
            data.transitions.map(CalmFlowTransition.fromJson),
            data['requirement-url'],
            CalmControl.fromJson(data.controls),
            CalmMetadata.fromJson(data.metadata)
        );
    }
}

export class CalmFlowTransition {
    constructor(
        public relationshipUniqueId: string,
        public sequenceNumber: number,
        public summary: string,
        public direction: CalmFlowDirection = 'source-to-destination'
    ) {}

    static fromJson(data: CalmFlowTransitionSchema): CalmFlowTransition {
        return new CalmFlowTransition(
            data['relationship-unique-id'],
            data['sequence-number'],
            data.summary,
            data.direction || 'source-to-destination'
        );
    }
}
