import { RulesetFunctionContext } from '@stoplight/spectral-core';

/**
 * Casts a minimal mock object to a {@link RulesetFunctionContext} for unit tests.
 *
 * The custom Spectral functions only read `context.document.data` and
 * `context.path`, so tests construct a partial context and use this helper to
 * satisfy the full type without restating every field.
 */
export function asContext(partial: unknown): RulesetFunctionContext {
    return partial as RulesetFunctionContext;
}
