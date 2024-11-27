import { JSONPath } from 'jsonpath-plus';

/**
 * Checks that the given input, a unique ID, is referenced by at least one relationship.
 */
export function nodeHasRelationship(input, _, context) {
    const nodeName = input;

    const relationshipLabels = JSONPath({path: '$.relationships[*].relationship-type..*@string()', json: context.document.data});
    const results = [];
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