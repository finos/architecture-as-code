import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the input value exists as a relationship with matching unique ID defined under a node in the document.
 */
export function relationshipIdExists(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }

    // get uniqueIds of all relationships
    const names = JSONPath({path: '$.relationships[*].unique-id', json: context.document.data as object});
    const results: IFunctionResult[] = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing relationship.`,
            path: [...context.path]
        });
    }
    return results;
}