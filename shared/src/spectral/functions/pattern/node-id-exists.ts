import { JSONPath } from 'jsonpath-plus';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
/**
 * Checks that the input value exists as a node with a matching unique ID.
 */
export default (input: unknown, _: unknown, context: RulesetFunctionContext): IFunctionResult[] => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const names = JSONPath({ path: '$.properties.nodes.prefixItems[*].properties.unique-id.const', json: context.document.data as object });
    const oneofs = JSONPath({ path: '$.properties.nodes.prefixItems[*].oneOf[*].properties.unique-id.const', json: context.document.data as object });
    const anyofs = JSONPath({ path: '$.properties.nodes.prefixItems[*].anyOf[*].properties.unique-id.const', json: context.document.data as object });
    // Nodes may also be declared in an `items.oneOf`/`items.anyOf` open catalog, not just positional prefixItems.
    const itemsOneofs = JSONPath({ path: '$.properties.nodes.items.oneOf[*].properties.unique-id.const', json: context.document.data as object });
    const itemsAnyofs = JSONPath({ path: '$.properties.nodes.items.anyOf[*].properties.unique-id.const', json: context.document.data as object });

    // get uniqueIds of all nodes
    const results: IFunctionResult[] = [];

    const allNodeIds = [...names, ...oneofs, ...anyofs, ...itemsOneofs, ...itemsAnyofs];

    if (!allNodeIds.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path],
        });
    }
    return results;
};
