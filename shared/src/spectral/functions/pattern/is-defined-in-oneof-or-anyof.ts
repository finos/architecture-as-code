import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { alternativeIdPaths, CalmType, fixedIdPath } from './declaration-paths';
/**
 * Checks that the input value should be defined in a oneOf or anyOf block.
 */
export function isDefinedInOneOfOrAnyOf(input: unknown, { calmType }: { calmType: CalmType }, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const fixed = JSONPath({ path: fixedIdPath(calmType), json: context.document.data as object });
    const inAlternatives = alternativeIdPaths(calmType).flatMap(path =>
        JSONPath({ path, json: context.document.data as object }));

    const results: IFunctionResult[] = [];

    if (fixed.includes(input) && !inAlternatives.includes(input)) {
        results.push({
            message: `'${input}' is part of a pattern option and must be defined in a oneOf or anyOf block.`,
            path: [...context.path],
        });
    }
    return results;
};
