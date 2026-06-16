import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the given input, a unique ID, is referenced by at least one relationship.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    const nodeId = input;

    const referencedNodeIds = JSONPath({path: '$..relationship-type..*@string()', json: context.document.data as object});

    const results: IFunctionResult[] = [];
    if (!referencedNodeIds) {
        return [{
            message: `Node with ID '${nodeId}' is not referenced by any relationships.`,
            path: [...context.path]
        }];
    }
    if (!referencedNodeIds.includes(nodeId)) {
        results.push({
            message: `Node with ID '${nodeId}' is not referenced by any relationships.`,
            path: [...context.path]
        });
    }
    return results;
};