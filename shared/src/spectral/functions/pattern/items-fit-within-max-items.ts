import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

interface CalmArray {
    maxItems?: number;
    prefixItems?: unknown[];
    items?: { oneOf?: unknown[]; anyOf?: unknown[] };
}

/**
 * `maxItems` counts the whole array, and the `prefixItems` entries fill it from the front.
 * An `items` member can only be built in what is left over.
 */
export function itemsFitWithinMaxItems(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    const array = input as CalmArray;
    const offersChoice = Boolean(array?.items?.oneOf || array?.items?.anyOf);
    const positions = array?.prefixItems?.length ?? 0;

    if (!offersChoice || array.maxItems === undefined || array.maxItems > positions) {
        return [];
    }

    return [{
        message: `maxItems is ${array.maxItems} and ${positions} prefixItems entries already fill it, so no items member can ever be built. Raise maxItems or remove items.`,
        path: [...context.path],
    }];
}
