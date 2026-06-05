import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the sequence numbers within a flow's transitions are unique.
 */
export function sequenceNumbersAreUnique(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }
    // get sequence-number of all transitions
    const sequenceNumbers = JSONPath({path: '$[*].sequence-number', json: input as object, resultType: 'all'});

    const seen = new Set();
    const messages: IFunctionResult[] = [];
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
