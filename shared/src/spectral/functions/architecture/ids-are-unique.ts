import { JSONPath } from 'jsonpath-plus';
import { detectDuplicates } from '../helper-functions';

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export function idsAreUnique(input, _, context) {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const nodeIdMatches = JSONPath({path: '$.nodes[*].unique-id', json: context.document.data, resultType: 'all'});
    const relationshipIdMatches = JSONPath({path: '$.relationships[*].unique-id', json: context.document.data, resultType: 'all'});
    const interfaceIdMatches = JSONPath({path: '$.nodes[*].interfaces[*].unique-id', json: context.document.data, resultType: 'all'});

    const seenIds = new Set();

    const messages = [];

    detectDuplicates(nodeIdMatches, seenIds, messages);
    detectDuplicates(relationshipIdMatches, seenIds, messages);
    detectDuplicates(interfaceIdMatches, seenIds, messages);

    return messages;
};