import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { declaredIdPaths } from './declaration-paths';

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const declaredIds = declaredIdPaths('nodes').flatMap(path =>
        JSONPath({ path, json: context.document.data as object }));

    const results: IFunctionResult[] = [];

    if (!declaredIds.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path],
        });
    }
    return results;
};
