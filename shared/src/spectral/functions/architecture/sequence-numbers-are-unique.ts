import { JSONPath } from 'jsonpath-plus';

/**
 * Checks that the sequence numbers within a flow's transitions are unique.
 */
export function sequenceNumbersAreUnique(input, _, context) {
    if (!input) {
        return [];
    }
    // get sequence-number of all transitions
    const sequenceNumbers = JSONPath({path: '$[*].sequence-number', json: input, resultType: 'all'});

    const seen = new Set();
    const messages = [];
    for (const match of sequenceNumbers) {
        const number = match['value'];

        if (seen.has(number)) {
            messages.push({
                message: `Duplicate sequence-number ${number} detected. path: ${match['pointer']}`,
                path: [...context.path]
            });
        }
        else {
            seen.add(number);
        }
    }

    return messages;
}
