/**
 * Checks that a current-moment is defined when the moments array is non-empty.
 */
export function currentMomentRequiredWhenMomentsNonEmpty(input) {
    if (!input) {
        return [];
    }

    const moments = input.moments;
    if (!Array.isArray(moments) || moments.length === 0) {
        return [];
    }

    const currentMoment = input['current-moment'];
    if (!currentMoment) {
        return [{
            message: 'Timeline has moments but no current-moment is set.',
            path: ['current-moment']
        }];
    }

    return [];
}
