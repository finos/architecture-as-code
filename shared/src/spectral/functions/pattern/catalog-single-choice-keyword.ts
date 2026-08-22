import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Reports a choice block that declares both `oneOf` and `anyOf`. Only `oneOf` is
 * resolved, so the `anyOf` candidates cannot be reached.
 *
 * The built-in `xor` cannot do this. A plain `items` schema declares neither keyword,
 * and it must be left alone.
 */
export function catalogSingleChoiceKeyword(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return [];
    }

    const items = input as Record<string, unknown>;
    if (!Array.isArray(items['oneOf']) || !Array.isArray(items['anyOf'])) {
        return [];
    }

    return [{
        message:
            'An items catalog declares both "oneOf" and "anyOf". Only the "oneOf" candidates are ' +
            'selectable - candidates under "anyOf" are silently dropped from generation and from ' +
            'the diagram. Declare exactly one of the two.',
        path: [...context.path],
    }];
}
