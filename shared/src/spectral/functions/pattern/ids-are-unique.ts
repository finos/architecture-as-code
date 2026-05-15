import { JSONPath } from 'jsonpath-plus';

/**
 * Returns the oneOf/anyOf group key for a JSON pointer, or null if the path is
 * not inside a oneOf/anyOf block.  Two pointers with the same group key are
 * siblings within the same choice block — only one will be instantiated, so
 * sharing a unique-id between them is intentional and should not be reported.
 */
function getChoiceGroup(pointer: string): string | null {
    // Greedily match up to the last oneOf/anyOf keyword, capturing the path up to
    // (but not including) the alternative index.
    const match = pointer.match(/^(.*\/(?:oneOf|anyOf))\/\d+\//);
    return match ? match[1] : null;
}

/**
 * Checks that all unique-ids in the pattern are unique across nodes, relationships,
 * and interfaces, including those defined inside anyOf/oneOf blocks.
 * Duplicate unique-ids within the same oneOf/anyOf block are allowed because
 * only one alternative will ever be instantiated.
 */
export default (input, _, context) => {
    if (!input) {
        return [];
    }
    // Use recursive descent to find all unique-id const values in the pattern,
    // including those nested inside anyOf/oneOf blocks.
    const allIdMatches = JSONPath({path: '$..*["unique-id"].const', json: context.document.data, resultType: 'all'});

    // Map from id → the choice group it was first seen in (null = definite/unconditional).
    const seenIds = new Map<string, string | null>();
    const messages = [];

    for (const match of allIdMatches) {
        const id = match['value'];
        const group = getChoiceGroup(match['pointer']);

        if (seenIds.has(id)) {
            const existingGroup = seenIds.get(id);
            // Siblings within the same oneOf/anyOf block may share a unique-id.
            if (group !== null && group === existingGroup) {
                continue;
            }
            messages.push({
                message: `Duplicate unique-id detected. ID: ${id}, path: ${match['pointer']}`,
                path: [match['pointer']]
            });
        } else {
            seenIds.set(id, group);
        }
    }

    return messages;
};
