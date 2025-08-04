import { CalmAdaptable } from './adaptable.js';
import { CalmMetadata } from './metadata.js';
import { CalmNode } from './node.js';
import { CalmRelationship } from './relationship.js';
import { CalmControls } from './control.js';
import { CalmFlow } from './flow.js';
import { CalmCoreSchema } from '../types/core-types.js';
import {CalmCoreCanonicalModel} from '../template/template-models';

export type Architecture = CalmCore

export class CalmCore implements CalmAdaptable<CalmCoreSchema, CalmCoreCanonicalModel> {
    constructor(
        public originalJson: CalmCoreSchema,
        public nodes: CalmNode[] = [],
        public relationships: CalmRelationship[] = [],
        public controls?: CalmControls,
        public flows?: CalmFlow[],
        public metadata?: CalmMetadata,
        public adrs?: string[]
    ) {}

    toCanonicalSchema(): CalmCoreCanonicalModel {
        return {
            nodes: this.nodes.map(node => node.toCanonicalSchema()),
            relationships: this.relationships.map(relationship => relationship.toCanonicalSchema()),
            controls: this.controls ? this.controls.toCanonicalSchema() : undefined,
            flows: this.flows ? this.flows.map(flow => flow.toCanonicalSchema()) : undefined,
            metadata: this.metadata ? this.metadata.toCanonicalSchema() : undefined,
            adrs: this.adrs ? this.adrs : undefined
        };
    }

    static fromSchema(schema: CalmCoreSchema): CalmCore {
        return new CalmCore(
            schema,
            (schema.nodes ?? []).map(CalmNode.fromSchema),
            (schema.relationships ?? []).map(CalmRelationship.fromSchema),
            schema.controls ? CalmControls.fromSchema(schema.controls) : undefined,
            schema.flows ? schema.flows.map(CalmFlow.fromSchema) : undefined,
            schema.metadata ? CalmMetadata.fromSchema(schema.metadata) : undefined,
            schema.adrs
        );
    }

    toSchema(): CalmCoreSchema {
        return this.originalJson;
    }
}
