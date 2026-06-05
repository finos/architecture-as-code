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

    // get uniqueIds of all nodes
    const results: IFunctionResult[] = [];

    if (!names.includes(input) && !oneofs.includes(input) && !anyofs.includes(input)) {
        results.push({
            message: `'${input}' does not refer to the unique-id of an existing node.`,
            path: [...context.path],
        });
    }
    return results;
};
