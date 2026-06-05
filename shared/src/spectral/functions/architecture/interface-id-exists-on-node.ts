import { JSONPath } from 'jsonpath-plus';
import { difference } from 'lodash';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';

interface ConnectsRelationship {
    node?: string;
    interfaces?: string[];
}

/**
 * Checks that the input value exists as an interface with matching unique ID defined under a node in the document.
 */
export function interfaceIdExistsOnNode(input: ConnectsRelationship | null | undefined, _: unknown, context: RulesetFunctionContext): IFunctionResult[] {
    if (!input || !input.interfaces) {
        return [];
    }

    if (!input.node) {
        return [{
            message: 'Invalid connects relationship - no node defined.',
            path: [...context.path]
        }];
    }

    const nodeId = input.node;
    const nodeMatch: object[] = JSONPath({ path: `$.nodes[?(@['unique-id'] == '${nodeId}')]`, json: context.document.data as object });
    if (!nodeMatch || nodeMatch.length === 0) {
        // other rule will report undefined node
        return [];
    }

    // all of these must be present on the referenced node
    const desiredInterfaces = input.interfaces;

    const node = nodeMatch[0];

    const nodeInterfaces = JSONPath({ path: '$.interfaces[*].unique-id', json: node });
    if (!nodeInterfaces || nodeInterfaces.length === 0) {
        return [
            { message: `Node with unique-id ${nodeId} has no interfaces defined, expected interfaces [${desiredInterfaces}].` }
        ];
    }

    const missingInterfaces = difference(desiredInterfaces, nodeInterfaces);

    // difference always returns an array
    if (missingInterfaces.length === 0) {
        return [];
    }
    const results: IFunctionResult[] = [];

    for (const missing of missingInterfaces) {
        results.push({
            message: `Referenced interface with ID '${missing}' was not defined on the node with ID '${nodeId}'.`,
            path: [...context.path]
        });
    }
    return results;
}