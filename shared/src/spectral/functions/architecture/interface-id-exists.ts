import { JSONPath } from 'jsonpath-plus';

/**
 * Checks that the input value exists as an interface with matching unique ID defined under a node in the document.
 */
export function interfaceIdExists(input, _, context) {
    if (!input) {
        return [];
    }

    // get uniqueIds of all interfaces 
    const names = JSONPath({path: '$.nodes[*].interfaces[*].unique-id', json: context.document.data});
    const results = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing interface.`,
            path: [...context.path]
        });
    }
    return results;
}