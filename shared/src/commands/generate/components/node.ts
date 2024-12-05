/* eslint-disable  @typescript-eslint/no-explicit-any */

import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { appendPath } from '../util.js';
import { instantiateGenericObject } from './instantiate.js';

/**
 * Instantiate an individual node from its definition, resolving $refs if appropriate. 
 * @param nodeDef The definition of the node.
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail.
 * @returns An instantiated node.
 */
export function instantiateNode(nodeDef: any, schemaDirectory: SchemaDirectory, path: string[], debug: boolean = false, instantiateAll: boolean = false): any {
    return instantiateGenericObject(nodeDef, schemaDirectory, 'node', path, debug, instantiateAll);
}

/**
 * Instantiate all nodes in the document.
 * @param pattern The pattern object to instantiate nodes from.
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail.
 * @returns An array of instantiated nodes.
 */
export function instantiateNodes(pattern: any, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): any {
    const logger = initLogger(debug);
    const nodes = pattern?.properties?.nodes?.prefixItems;
    if (!nodes) {
        logger.error('Warning: pattern has no nodes defined.');
        if (pattern?.properties?.nodes?.items) {
            logger.warn('Note: properties.nodes.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }
    const outputNodes = [];

    for (const [index, node] of nodes.entries()) {
        const path = appendPath<string>(['nodes'], index);
        outputNodes.push(instantiateNode(node, schemaDirectory, path, debug, instantiateAll));
    }
    return outputNodes;
}