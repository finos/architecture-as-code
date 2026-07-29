// Pure builder for governed building-block ("building block") CALM documents.
// Extracted from BuildingBlockCreator so the authoring logic can be unit-tested
// without rendering the React component.

export type ValidationType = 'none' | 'pattern' | 'allowed-values';

export interface ControlValidation {
    type: ValidationType;
    pattern?: string;
    example?: string;
    allowedValues?: string[];
}

export interface ControlEntry {
    id: string;
    description: string;
    requirementUrl: string;
    validation: ControlValidation;
}

export interface BuildingBlockInput {
    name: string;
    nodeType: string;
    description: string;
    controls: ControlEntry[];
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
 * block from the authoring form's state. Controls with pattern / allowed-values
 * validation are emitted under `metadata.validation`.
 */
export function buildBuildingBlockDoc(
    input: BuildingBlockInput
): BuiltBuildingBlock {
    const nodeId = generateId(input.name);
    const controlsObj: Record<string, unknown> = {};

    for (const ctrl of input.controls) {
        const controlId = ctrl.id || generateId(ctrl.description || 'control');
        const entry: Record<string, unknown> = {
            description: ctrl.description,
            requirements: [
                { 'requirement-url': ctrl.requirementUrl || '', config: {} },
            ],
        };

        if (ctrl.validation.type !== 'none') {
            const validationMeta: Record<string, unknown> = {};
            if (ctrl.validation.type === 'pattern') {
                validationMeta.pattern = ctrl.validation.pattern ?? '';
                if (ctrl.validation.example)
                    validationMeta.example = ctrl.validation.example;
            } else if (ctrl.validation.type === 'allowed-values') {
                validationMeta['allowed-values'] =
                    ctrl.validation.allowedValues ?? [];
            }
            entry.metadata = { validation: validationMeta };
        }

        controlsObj[controlId] = entry;
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
