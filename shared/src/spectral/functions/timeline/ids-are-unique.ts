import { JSONPath } from 'jsonpath-plus';
import { detectDuplicates } from '../helper-functions';

/**
 * Checks that unique-id is unique across all moments in the timeline.
 */
export function idsAreUnique(input, _, context) {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const momentIdMatches = JSONPath({path: '$.moments[*].unique-id', json: context.document.data, resultType: 'all'});

    const seenIds = new Set();

    const messages = [];

    detectDuplicates(momentIdMatches, seenIds, messages);

    return messages;
}