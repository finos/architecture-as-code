import { JSONPath } from 'jsonpath-plus';

/**
 * Checks that the input value exists as a moment with a matching unique ID.
 */
export function momentIdExists(input, _, context) {
    if (!input) {
        return [];
    }
    // get uniqueIds of all moments
    const names = JSONPath({ path: '$.moments[*].unique-id', json: context.document.data });
    const results = [];

    if (!names.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing moment.`,
            path: [...context.path]
        });
    }
    return results;
}