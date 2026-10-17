// Pure builder for governed building-block ("building block") CALM documents.
// Extracted from BuildingBlockCreator so the authoring logic can be unit-tested
// without rendering the React component.

import { makeControlMapKey } from '../../extension/services/control-curie';
import type { ParsedRequirement } from '../../extension/services/requirement-parser';

/** A control attached via the control picker — a Hub CURIE or local path ref plus its parsed requirement. */
export interface AttachedControl {
    ref: string;
    parsed: ParsedRequirement;
}

export interface BuildingBlockInput {
    name: string;
    nodeType: string;
    description: string;
    controls: AttachedControl[];
}

export interface BuiltBuildingBlock {
    json: string;
    fileName: string;
}

export function generateId(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * Build a CALM document (plus its target file name) for a governed building
 * block. Each attached control is emitted as a slim reference — just
 * `requirement-url` (CURIE or local path) and description. Config is filled
 * in when the building block is instantiated on a node.
 */
export function buildBuildingBlockDoc(
    input: BuildingBlockInput
): BuiltBuildingBlock {
    const nodeId = generateId(input.name);
    const controlsObj: Record<string, unknown> = {};

    for (const ctrl of input.controls) {
        const key = makeControlMapKey(ctrl.ref);
        controlsObj[key] = {
            requirements: [{ 'requirement-url': ctrl.ref }],
        };
    }

    const doc = {
        $schema: 'https://calm.finos.org/release/1.2/meta/core.json',
        nodes: [
            {
                'unique-id': `building-block-${nodeId}`,
                'node-type': input.nodeType,
                name: input.name,
                description: input.description,
                controls: controlsObj,
                metadata: { 'building-block-type': 'infrastructure' },
            },
        ],
        relationships: [],
    };

    return {
        json: JSON.stringify(doc, null, 2),
        fileName: `${nodeId}.calm.json`,
    };
}
