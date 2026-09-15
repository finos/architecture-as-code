import { JSONPath } from 'jsonpath-plus';
import { difference } from 'lodash';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { declarationPaths, declaredId } from './declaration-paths';

interface ConnectsRelationship {
    node?: string;
    interfaces?: string[];
}

/**
 * One declaration site at a time, because a node is nearly always a plain prefixItems
 * entry and the later sites then never run.
 */
function findDeclaredNode(json: object, nodeId: string): object | undefined {
    for (const path of declarationPaths('nodes')) {
        const declarations: object[] = JSONPath({ path, json });
        const node = declarations.find(declaration => declaredId(declaration) === nodeId);
        if (node) {
            return node;
        }
    }
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

    const node = findDeclaredNode(context.document.data as object, input.node);
    if (!node) {
        // other rule will report undefined node
        return [];
    }

    // all of these must be present on the referenced node
    const desiredInterfaces = input.interfaces;

    const nodeInterfaces = JSONPath({ path: '$.properties.interfaces.prefixItems[*].properties.unique-id.const', json: node });
    if (!nodeInterfaces || nodeInterfaces.length === 0) {
        return [
            { message: `Node with unique-id ${input.node} has no interfaces defined, expected interfaces [${desiredInterfaces}]` }
        ];
    }

    const missingInterfaces = difference(desiredInterfaces, nodeInterfaces);

    //difference always returns an array
    if (missingInterfaces.length === 0) {
        return [];
    }
    const results: IFunctionResult[] = [];

    for (const missing of missingInterfaces) {
        results.push({
            message: `Referenced interface with ID '${missing}' was not defined on the node with ID '${input.node}'.`,
            path: [...context.path]
        });
    }
    return results;
}