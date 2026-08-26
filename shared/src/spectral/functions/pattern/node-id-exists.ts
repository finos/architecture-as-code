import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { listDeclaredCandidates, type SchemaNode } from '@finos/calm-models/pattern';

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const pattern = context.document.data as SchemaNode;
    const nodeIds = listDeclaredCandidates(pattern, 'nodes').map((candidate) => candidate.uniqueId);

    const results: IFunctionResult[] = [];

    if (!nodeIds.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path],
        });
    }
    return results;
};
