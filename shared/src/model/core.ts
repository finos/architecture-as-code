import { CalmNode } from './node.js';
import { CalmRelationship } from './relationship.js';
import { CalmFlow } from './flow.js';
import { CalmControl } from './control.js';
import { CalmMetadata } from './metadata.js';
import { CalmCoreSchema } from '../types/core-types.js';

export class CalmCore {
    constructor(
        public nodes: CalmNode[],
        public relationships: CalmRelationship[],
        public metadata: CalmMetadata,
        public controls: CalmControl[],
        public flows: CalmFlow[]
    ) {}

    static fromJson(data: CalmCoreSchema): CalmCore {
        return new CalmCore(
            data.nodes? data.nodes.map(CalmNode.fromJson) : [],
            data.relationships?  data.relationships.map(CalmRelationship.fromJson) : [],
            data.metadata? CalmMetadata.fromJson(data.metadata) : new CalmMetadata({}),
            data.controls? CalmControl.fromJson(data.controls) : [],
            data.flows? data.flows.map(CalmFlow.fromJson) : []
        );
    }
}

export { CalmCore as Architecture };
export { CalmCore as Pattern };
