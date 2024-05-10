/* eslint-disable  @typescript-eslint/no-explicit-any */

import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { logRequiredMessage, mergeSchemas } from '../util.js';
import { getPropertyValue } from './property.js';


/**
 * Instantiates an individual relationship.
 * @param relationshipDef The relationship definition to instantiate
 * @param schemaDirectory The schema directory to resolve refs against.
 * @param debug Whether to log debug detail
 * @returns An instantiated relationship.
 */
function instantiateRelationship(relationshipDef: object, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): object {
    const logger = initLogger(debug);
    let fullDefinition = relationshipDef;
    if (relationshipDef['$ref']) {
        const ref = relationshipDef['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref);

        fullDefinition = mergeSchemas(schemaDef, relationshipDef);
    }

    if (!('properties' in fullDefinition)) {
        return {};
    }

    const required = fullDefinition['required'];

    logger.debug('Generating interface from ' + JSON.stringify(fullDefinition, undefined, 2));
    logRequiredMessage(logger, required, instantiateAll);

    const out = {};
    for (const [key, detail] of Object.entries(fullDefinition['properties'])) {
        if (!instantiateAll && required && !required.includes(key)) {
            logger.debug('Skipping property ' + key + ' as it is not marked as required.');
            continue;
        }
        out[key] = getPropertyValue(key, detail);
    }

    return out;
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