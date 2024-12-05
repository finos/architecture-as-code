/* eslint-disable  @typescript-eslint/no-explicit-any */

import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { appendPath } from '../util.js';
import { instantiateGenericObject } from './instantiate.js';


/**
 * Instantiates an individual relationship.
 * @param relationshipDef The relationship definition to instantiate
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param path The current path in the document, for logging purposes.
 * @param debug Whether to log debug detail
 * @returns An instantiated relationship.
 */
function instantiateRelationship(relationshipDef: object, schemaDirectory: SchemaDirectory, path: string[], debug: boolean = false, instantiateAll: boolean = false): object {
    const relationship = instantiateGenericObject(relationshipDef, schemaDirectory, 'relationship', path, debug, instantiateAll);
    if (typeof relationship !== 'object') {
        const message = 'Expected an object during instantiation, got a string. Could there be a top-level $ref to an enum or string type?';
        initLogger(debug).error(message);
        throw Error(message);
    }
    return relationship;
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
    for (const [index, relationship] of relationships.entries()) {
        const path = appendPath<string>(['relationships'], index);
        outputRelationships.push(instantiateRelationship(relationship, schemaDirectory, path, debug, instantiateAll));
    }

    return outputRelationships;
}