/* eslint-disable  @typescript-eslint/no-explicit-any */

import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { logRequiredMessage, mergeSchemas } from '../util.js';
import { instantiateGenericObject } from './instantiate.js';
import { getPropertyValue } from './property.js';


/**
 * Instantiates an individual relationship.
 * @param relationshipDef The relationship definition to instantiate
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail
 * @returns An instantiated relationship.
 */
function instantiateRelationship(relationshipDef: object, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): object {
    return instantiateGenericObject(relationshipDef, schemaDirectory, 'relationship', debug, instantiateAll);
}

/**
 * Instantiate all relationships in the document.
 * @param pattern The pattern object to instantiate relationships from.
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail.
 * @returns An array of instantiated relationships.
 */
export function instantiateRelationships(pattern: any, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): any {
    const logger = initLogger(debug);
    const relationships = pattern?.properties?.relationships?.prefixItems;

    if (!relationships) {
        logger.error('Warning: pattern has no relationships defined');
        if (pattern?.properties?.relationships?.items) {
            logger.warn('Note: properties.relationships.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }

    const outputRelationships = [];
    for (const relationship of relationships) {
        outputRelationships.push(instantiateRelationship(relationship, schemaDirectory, debug, instantiateAll));
    }

    return outputRelationships;
}