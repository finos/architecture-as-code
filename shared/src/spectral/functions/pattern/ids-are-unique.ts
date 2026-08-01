import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { detectDuplicates } from '../helper-functions';
/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input) {
        return [];
    }
    // get uniqueIds of all nodes
    const nodeIdMatches = JSONPath({path: '$.properties.nodes.prefixItems[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const nodeItemsOneOfIdMatches = JSONPath({path: '$.properties.nodes.items.oneOf[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const nodeItemsAnyOfIdMatches = JSONPath({path: '$.properties.nodes.items.anyOf[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const relationshipIdMatches = JSONPath({path: '$.properties.relationships.prefixItems[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const relationshipItemsOneOfIdMatches = JSONPath({path: '$.properties.relationships.items.oneOf[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const relationshipItemsAnyOfIdMatches = JSONPath({path: '$.properties.relationships.items.anyOf[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const interfaceIdMatches = JSONPath({path: '$.properties.nodes.prefixItems[*].properties.interfaces.prefixItems[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const interfaceItemsOneOfIdMatches = JSONPath({path: '$.properties.nodes.items.oneOf[*].properties.interfaces.prefixItems[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});
    const interfaceItemsAnyOfIdMatches = JSONPath({path: '$.properties.nodes.items.anyOf[*].properties.interfaces.prefixItems[*].properties.unique-id.const', json: context.document.data as object, resultType: 'all'});

    const seenIds = new Set();

    const messages: IFunctionResult[] = [];

    detectDuplicates(nodeIdMatches, seenIds, messages);
    detectDuplicates(nodeItemsOneOfIdMatches, seenIds, messages);
    detectDuplicates(nodeItemsAnyOfIdMatches, seenIds, messages);
    detectDuplicates(relationshipIdMatches, seenIds, messages);
    detectDuplicates(relationshipItemsOneOfIdMatches, seenIds, messages);
    detectDuplicates(relationshipItemsAnyOfIdMatches, seenIds, messages);
    detectDuplicates(interfaceIdMatches, seenIds, messages);
    detectDuplicates(interfaceItemsOneOfIdMatches, seenIds, messages);
    detectDuplicates(interfaceItemsAnyOfIdMatches, seenIds, messages);

    return messages;
};