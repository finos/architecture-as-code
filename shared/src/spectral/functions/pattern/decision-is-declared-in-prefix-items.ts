import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { declaredId } from './declaration-paths';

/**
 * An architecture always contains every relationship a pattern declares in prefixItems, so
 * a decision declared there is always asked. An items member may be left out, so a
 * decision declared there can vanish, and declining it stops being a choice.
 */
export function decisionIsDeclaredInPrefixItems(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    const relationship = input as object;
    if (!relationship || JSONPath({ path: '$.properties.relationship-type.properties.options', json: relationship }).length === 0) {
        return [];
    }

    return [{
        message: `The decision '${declaredId(relationship) ?? 'unknown'}' is declared in items. Declare a decision in relationships prefixItems, so that an answer can decline it.`,
        path: [...context.path],
    }];
}
