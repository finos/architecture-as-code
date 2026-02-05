/**
 * Checks that the moments array exists and is non-empty.
 */
export function momentsMustBeNonEmpty(input) {
    if (!input) {
        return [];
    }

    const moments = input.moments;
    if (!Array.isArray(moments) || moments.length === 0) {
        return [{
            message: 'Timeline must define at least one moment.',
            path: ['moments']
        }];
    }

    return [];
}
