import { JSONPath } from 'jsonpath-plus';
/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input, _, context) => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const names = JSONPath({ path: '$.properties.nodes.prefixItems[*].properties.unique-id.const', json: context.document.data });
    const oneofs = JSONPath({ path: '$.properties.nodes.prefixItems[*].oneOf[*].properties.unique-id.const', json: context.document.data });
    const anyofs = JSONPath({ path: '$.properties.nodes.prefixItems[*].anyOf[*].properties.unique-id.const', json: context.document.data });

    // get uniqueIds of all nodes
    const results = [];

    if (!names.includes(input) && !oneofs.includes(input) && !anyofs.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path],
        });
    }
    return results;
};
