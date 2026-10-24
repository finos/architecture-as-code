// Pure builder for governed standard-node ("building block") CALM documents.
// Extracted from StandardNodeCreator so the authoring logic can be unit-tested
// without rendering the React component.

import { makeControlMapKey } from '../../extension/services/control-curie';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';
import { slugify as generateId } from './control-doc';
import { CALM_META_SCHEMA_BASE_URL } from '../../core/calm-schema-release';

/** A control attached via the control picker — a Hub CURIE or local path ref plus its parsed requirement. */
export interface AttachedControl {
    ref: string;
    parsed: ParsedRequirement;
}

export interface StandardNodeInput {
    name: string;
    nodeType: string;
    description: string;
    controls: AttachedControl[];
}

export interface BuiltStandardNode {
    json: string;
    fileName: string;
}

export { generateId };

/**
 * Build a CALM document (plus its target file name) for a governed building
 * block. Each attached control is emitted as a slim reference — just
 * `requirement-url` (CURIE or local path) and description. Config is filled
 * in when the building block is instantiated on a node.
 */
export function buildStandardNodeDoc(
    input: StandardNodeInput
): BuiltStandardNode {
    const nodeId = generateId(input.name);
    const controlsObj: Record<string, unknown> = {};

    for (const ctrl of input.controls) {
        const key = makeControlMapKey(ctrl.ref);
        controlsObj[key] = {
            requirements: [{ 'requirement-url': ctrl.ref }],
        };
    }

    const doc = {
        $schema: `${CALM_META_SCHEMA_BASE_URL}/core.json`,
        nodes: [
            {
                'unique-id': `standard-node-${nodeId}`,
                'node-type': input.nodeType,
                name: input.name,
                description: input.description,
                controls: controlsObj,
                metadata: { 'standard-node-type': 'infrastructure' },
            },
        ],
        relationships: [],
    };

    return {
        json: JSON.stringify(doc, null, 2),
        fileName: `${nodeId}.calm.json`,
    };
}
