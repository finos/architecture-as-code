import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the input value exists as a moment with a matching unique ID.
 */
export function momentIdExists(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }
    // get uniqueIds of all moments
    const names = JSONPath({ path: '$.moments[*].unique-id', json: context.document.data as object });
    const results: IFunctionResult[] = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing moment.`,
            path: [...context.path]
        });
    }
    return results;
}