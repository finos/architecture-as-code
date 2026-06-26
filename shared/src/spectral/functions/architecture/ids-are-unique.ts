import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates } from '../helper-functions';

/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export function idsAreUnique(input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const nodeIdMatches = JSONPath({path: '$.nodes[*].unique-id', json: context.document.data as object, resultType: 'all'});
    const relationshipIdMatches = JSONPath({path: '$.relationships[*].unique-id', json: context.document.data as object, resultType: 'all'});
    const interfaceIdMatches = JSONPath({path: '$.nodes[*].interfaces[*].unique-id', json: context.document.data as object, resultType: 'all'});

    const seenIds = new Set();

    const messages: IFunctionResult[] = [];

    detectDuplicates(nodeIdMatches, seenIds, messages);
    detectDuplicates(relationshipIdMatches, seenIds, messages);
    detectDuplicates(interfaceIdMatches, seenIds, messages);

    return messages;
}
