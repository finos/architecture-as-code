import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
/**
 * Checks that the input value should be defined in a oneOf or anyOf block.
 */
export function isDefinedInOneOfOrAnyOf(input: unknown, { calmType }: { calmType: 'nodes' | 'relationships'}, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const names = JSONPath({ path: `$.properties.${calmType}.prefixItems[*].properties.unique-id.const`, json: context.document.data as object });
    const oneofs = JSONPath({ path: `$.properties.${calmType}.prefixItems[*].oneOf[*].properties.unique-id.const`, json: context.document.data as object });
    const anyofs = JSONPath({ path: `$.properties.${calmType}.prefixItems[*].anyOf[*].properties.unique-id.const`, json: context.document.data as object });

    const results: IFunctionResult[] = [];

    if (names.includes(input) && !oneofs.includes(input) && !anyofs.includes(input)) {
        results.push({
            message: `'${input}' is part of a pattern option and must be defined in a oneOf or anyOf block.`,
            path: [...context.path],
        });
    }
    return results;
};
