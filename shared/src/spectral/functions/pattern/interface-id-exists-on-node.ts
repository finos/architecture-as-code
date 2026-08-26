import { difference } from 'lodash';
import { IFunctionResult, RulesetFunctionContext } from '@stoplight/spectral-core';
import { listDeclaredCandidates, listNodeInterfaces, type SchemaNode } from '@finos/calm-models/pattern';

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
    const pattern = context.document.data as SchemaNode;
    // Each candidate carries its own unique-id, so this finds the exact alternative that
    // matches - not, as the old JSONPath-based lookup did, just the first alternative in
    // a oneOf/anyOf slot regardless of which one actually has this id.
    const nodeCandidate = listDeclaredCandidates(pattern, 'nodes').find((candidate) => candidate.uniqueId === nodeId);
    if (!nodeCandidate) {
        // other rule will report undefined node
        return [];
    }

    // all of these must be present on the referenced node
    const desiredInterfaces = input.interfaces;

    // Only this node's own interfaces - not, as before, the union of interfaces declared
    // across every alternative in its oneOf/anyOf slot.
    const nodeInterfaces = listNodeInterfaces(nodeCandidate.node).map((iface) => iface.uniqueId);
    if (nodeInterfaces.length === 0) {
        return [
            { message: `Node with unique-id ${nodeId} has no interfaces defined, expected interfaces [${desiredInterfaces}]` }
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
            message: `Referenced interface with ID '${missing}' was not defined on the node with ID '${nodeId}'.`,
            path: [...context.path]
        });
    }
    return results;
}
