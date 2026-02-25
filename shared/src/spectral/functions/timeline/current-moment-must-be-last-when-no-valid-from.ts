/**
 * Checks that current-moment is the last moment when no valid-from values exist.
 */
export function currentMomentMustBeLastWhenNoValidFrom(input) {
    if (!input) {
        return [];
    }

    const moments = input.moments;
    if (!Array.isArray(moments) || moments.length === 0) {
        return [];
    }

    const currentMomentId = input['current-moment'];
    if (!currentMomentId) {
        return [];
    }

    const hasValidFrom = moments.some((moment) => Boolean(moment && moment['valid-from']));
    if (hasValidFrom) {
        return [];
    }

    const lastMoment = moments[moments.length - 1];
    const lastMomentId = lastMoment['unique-id'];

    if (currentMomentId !== lastMomentId) {
        return [{
            message: `Current-moment "${currentMomentId}" should be the last moment when no valid-from values are defined.`,
            path: ['current-moment']
        }];
    }

    return [];
}
