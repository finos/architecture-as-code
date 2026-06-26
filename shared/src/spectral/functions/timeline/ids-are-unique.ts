import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates } from '../helper-functions';

/**
 * Checks that unique-id is unique across all moments in the timeline.
 */
export function idsAreUnique(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }
    // get uniqueIds of all moments
    const momentIdMatches = JSONPath({ path: '$.moments[*].unique-id', json: context.document.data as object, resultType: 'all' });

    const seenIds = new Set();

    const messages: IFunctionResult[] = [];

    detectDuplicates(momentIdMatches, seenIds, messages);

    return messages;
}