import { CalmNodeSchema, CalmRelationshipSchema } from '@finos/calm-models/types';

/** True when the selected item is a CALM node (vs a relationship/edge). */
export function isCALMNode(data: CalmNodeSchema | CalmRelationshipSchema): data is CalmNodeSchema {
    return 'node-type' in data;
}

/** True when the selected item is a CALM relationship (edge). */
export function isCALMRelationship(data: CalmNodeSchema | CalmRelationshipSchema): data is CalmRelationshipSchema {
    return 'relationship-type' in data;
}
