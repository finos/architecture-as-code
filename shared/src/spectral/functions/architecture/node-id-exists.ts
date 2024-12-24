import { JSONPath } from 'jsonpath-plus';

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export function nodeIdExists(input, _, context) {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const names = JSONPath({path: '$.nodes[*].unique-id', json: context.document.data});
    const results = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path]
        });
    }
    return results;
}