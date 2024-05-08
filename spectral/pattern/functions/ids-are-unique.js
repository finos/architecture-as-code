import { JSONPath } from 'jsonpath-plus';

function detectDuplicates(matches, seenIds, messages) {
    for (const match of matches) {
        const id = match['value']

        if (seenIds.has(id)) {
            messages.push({
                message: `Duplicate unique-id detected. ID: ${id}, path: ${match['pointer']}`,
                path: [match['pointer']]
            })
        }
        else {
            seenIds.add(id)
        }
    }
}

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input, _, context) => {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const nodeIdMatches = JSONPath({path: '$.properties.nodes.prefixItems[*].properties.unique-id.const', json: context.document.data, resultType: 'all'});
    const relationshipIdMatches = JSONPath({path: '$.properties.relationships.prefixItems[*].properties.unique-id.const', json: context.document.data, resultType: 'all'});
    const interfaceIdMatches = JSONPath({path: '$.properties.nodes.prefixItems[*].properties.interfaces.prefixItems[*].properties.unique-id.const', json: context.document.data, resultType: 'all'});

    let seenIds = new Set();

    let messages = [];

    detectDuplicates(nodeIdMatches, seenIds, messages)
    detectDuplicates(relationshipIdMatches, seenIds, messages)
    detectDuplicates(interfaceIdMatches, seenIds, messages)

    return messages;
}