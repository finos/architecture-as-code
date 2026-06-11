import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Checks that the current-moment has no moments after it with a valid-from date.
 */
export function validFromNotAfterCurrentMoment(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }

    const moments: object[] = JSONPath({ path: '$.moments[*]', json: context.document.data as object, resultType: 'value' });
    if (!moments || moments.length === 0) {
        // other rule will report no moments defined
        return [];
    }

    const currentMomentId = input as string;
    let checkingValidFroms = false;
    const results: IFunctionResult[] = [];
    for (const moment of moments) {
        const momentId: string = JSONPath({ path: '$.unique-id', json: moment, wrap: false }) as string;
        if (momentId && momentId === currentMomentId) {
            checkingValidFroms = true;
            continue;
        }

        if (checkingValidFroms) {
            const validFrom: string = JSONPath({path: '$.valid-from', json: moment, wrap: false }) as string;
            if (validFrom) {
                results.push({
                    message: `Moment with unique-id "${momentId}" is after current-moment "${currentMomentId}" but has a valid-from.`
                });
            }
        }
    }

    return results;
}