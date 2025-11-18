import { JSONPath } from 'jsonpath-plus';

/**
 * Checks that the input value exists as an interface with matching unique ID defined under a node in the document.
 */
export function validFromNotAfterCurrentMoment(input, _, context) {
    if (!input) {
        return [];
    }

    const moments: object[] = JSONPath({ path: '$.moments[*]', json: context.document.data, resultType: 'value' });
    if (!moments || moments.length === 0) {
        // other rule will report no moments defined
        return [];
    }

    const currentMomentId: string = input;
    let checkingValidFroms = false;
    const results = [];
    for (const moment of moments) {
        const momentId: string = JSONPath({ path: '$.unique-id', json: moment, wrap: false }) as string;
        if (momentId && momentId === currentMomentId) {
            checkingValidFroms = true;
            continue;
        }

        if (checkingValidFroms) {
            const validFrom: string = JSONPath({path: '$.valid-from', json: moment }) as string;
            if (validFrom) {
                results.push({
                    message: `Moment with unique-id "${momentId}" is after current-moment "${currentMomentId}" but has a valid-from.`
                });
            }
        }
    }

    return results;
}