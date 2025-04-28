import { JSONPath } from 'jsonpath-plus';
import { difference } from 'lodash';

/**
 * Checks that the input value exists as an interface with matching unique ID defined under a node in the document.
 */
export function interfaceIdExistsOnNode(input, _, context) {
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
    const nodes: object[] = JSONPath({ path: '$.properties.nodes.prefixItems[*]', json: context.document.data });
    const node = nodes.find((node) => {
        const uniqueId: string[] = JSONPath({ path: '$.properties.unique-id.const', json: node });
        uniqueId.push(...JSONPath({ path: '$.oneOf[*].properties.unique-id.const', json: node }));
        uniqueId.push(...JSONPath({ path: '$.anyOf[*].properties.unique-id.const', json: node }));
        return uniqueId && uniqueId[0] === nodeId;
    });
    if (!node) {
        // other rule will report undefined node
        return [];
    }

    // all of these must be present on the referenced node
    const desiredInterfaces = input.interfaces;

    const nodeInterfaces = JSONPath({ path: '$.properties.interfaces.prefixItems[*].properties.unique-id.const', json: node });
    nodeInterfaces.push(...JSONPath({ path: '$.oneOf[*].properties.interfaces.prefixItems[*].properties.unique-id.const', json: node }));
    nodeInterfaces.push(...JSONPath({ path: '$.anyOf[*].properties.interfaces.prefixItems[*].properties.unique-id.const', json: node }));
    if (!nodeInterfaces || nodeInterfaces.length === 0) {
        return [
            { message: `Node with unique-id ${nodeId} has no interfaces defined, expected interfaces [${desiredInterfaces}]` }
        ];
    }

    const missingInterfaces = difference(desiredInterfaces, nodeInterfaces);

    //difference always returns an array
    if (missingInterfaces.length === 0) {
        return [];
    }
    const results = [];

    for (const missing of missingInterfaces) {
        results.push({
            message: `Referenced interface with ID '${missing}' was not defined on the node with ID '${nodeId}'.`,
            path: [...context.path]
        });
    }
    return results;
}