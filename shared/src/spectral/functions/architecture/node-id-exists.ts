import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export function nodeIdExists(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const names = JSONPath({path: '$.nodes[*].unique-id', json: context.document.data as object});
    const results: IFunctionResult[] = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path]
        });
    }
    return results;
}