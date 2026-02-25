/**
 * Checks that moments with valid-from are ordered by date.
 */
export function momentsSortedByValidFrom(input, _, _context) {
    if (!input) {
        return [];
    }

    const moments = input.moments;
    if (!Array.isArray(moments) || moments.length < 2) {
        return [];
    }

    const results = [];
    let lastValidFromTimestamp: number | null = null;
    let lastValidFromValue: string | null = null;

    for (let index = 0; index < moments.length; index += 1) {
        const moment = moments[index];
        const validFrom = moment ? moment['valid-from'] : undefined;
        if (!validFrom) {
            continue;
        }

        const timestamp = Date.parse(validFrom);
        if (Number.isNaN(timestamp)) {
            continue;
        }

        if (lastValidFromTimestamp !== null && timestamp < lastValidFromTimestamp) {
            const momentId = moment ? moment['unique-id'] : undefined;
            const momentLabel = momentId ? `unique-id "${momentId}"` : `index ${index}`;
            results.push({
                message: `Moment with ${momentLabel} has valid-from "${validFrom}" which is before the previous valid-from "${lastValidFromValue}".`,
                path: ['moments', index, 'valid-from']
            });
        }

        lastValidFromTimestamp = timestamp;
        lastValidFromValue = validFrom;
    }

    return results;
}
