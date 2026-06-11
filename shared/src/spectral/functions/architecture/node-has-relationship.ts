import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the given input, a unique ID, is referenced by at least one relationship.
 */
export function nodeHasRelationship(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    const nodeName = input;

    const relationshipLabels = JSONPath({path: '$.relationships[*].relationship-type..*@string()', json: context.document.data as object});
    const results: IFunctionResult[] = [];
    if (!relationshipLabels) {
        return [{
            message: `Node with ID '${nodeName}' is not referenced by any relationships.`,
            path: [...context.path]
        }];
    }
    if (!relationshipLabels.includes(nodeName)) {
        results.push({
            message: `Node with ID '${nodeName}' is not referenced by any relationships.`,
            path: [...context.path]
        });
    }
    return results;
}