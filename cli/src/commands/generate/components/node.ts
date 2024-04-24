/* eslint-disable  @typescript-eslint/no-explicit-any */

import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { mergeSchemas } from '../util.js';
import { getPropertyValue } from './property.js';

/**
 * Instantiate an individual node from its definition, resolving $refs if appropriate. 
 * @param nodeDef The definition of the node.
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail.
 * @returns An instantiated node.
 */
export function instantiateNode(nodeDef: any, schemaDirectory: SchemaDirectory, debug: boolean = false): any {
    const logger = initLogger(debug);
    let fullDefinition = nodeDef;
    if (nodeDef['$ref']) {
        const ref = nodeDef['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, nodeDef);
    }
    logger.debug('Generating node from ' + JSON.stringify(fullDefinition));
    
    if (!('properties' in fullDefinition)) {
        return {};
    }

    const out = {};
    for (const [key, detail] of Object.entries(fullDefinition['properties'])) {
        if (key === 'interfaces') {
            const interfaces = instantiateNodeInterfaces(detail, schemaDirectory, debug);
            out['interfaces'] = interfaces;
        }
        else {
            out[key] = getPropertyValue(key, detail);
        }
    }
    return out;
}

/**
 * Instantiate all nodes in the document.
 * @param pattern The pattern object to instantiate nodes from.
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail.
 * @returns An array of instantiated nodes.
 */
export function instantiateNodes(pattern: any, schemaDirectory: SchemaDirectory, debug: boolean = false): any {
    const logger = initLogger(debug);
    const nodes = pattern?.properties?.nodes?.prefixItems;
    if (!nodes) {
        logger.error('Warning: pattern has no nodes defined.');
        if (pattern?.properties?.nodes?.items) {
            logger.warn('Note: properties.relationships.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }
    const outputNodes = [];

    for (const node of nodes) {
        outputNodes.push(instantiateNode(node, schemaDirectory));
    }
    return outputNodes;
}

/**
 * Instantiate an individual interface on a node.
 * @param interfaceDef The definition of the interface.
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail.
 * @returns An instantiated interface.
 */
export function instantiateInterface(interfaceDef: object, schemaDirectory: SchemaDirectory, debug: boolean = false): object {
    const logger = initLogger(debug);
    let fullDefinition = interfaceDef;
    if (interfaceDef['$ref']) {
        const ref = interfaceDef['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, interfaceDef);
    }

    logger.debug('Generating interface from ' + JSON.stringify(fullDefinition, undefined, 2));
    
    if (!('properties' in fullDefinition)) {
        return {};
    }

    const out = {};
    for (const [key, detail] of Object.entries(fullDefinition['properties'])) {
        out[key] = getPropertyValue(key, detail);
    }

    return out;
}

export function instantiateNodeInterfaces(detail: any, schemaDirectory: SchemaDirectory, debug: boolean = false): any[] {
    const logger = initLogger(debug);
    const interfaces = [];
    if (!('prefixItems' in detail)) {
        logger.error('No items in interfaces block.');
        return [];
    }

    const interfaceDefs = detail.prefixItems;
    for (const interfaceDef of interfaceDefs) {
        interfaces.push(instantiateInterface(interfaceDef, schemaDirectory, debug));
    }

    return interfaces;
}