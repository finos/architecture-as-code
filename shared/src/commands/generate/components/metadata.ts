import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { logRequiredMessage, mergeSchemas } from '../util.js';
import { getPropertyValue } from './property.js';

export function instantiateMetadataObject(definition: object, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): object {
    const logger = initLogger(debug);
    let fullDefinition = definition;
    if (definition['$ref']) {
        const ref = definition['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, definition);
    }
    logger.debug('Generating metadata object from ' + JSON.stringify(fullDefinition));
    
    if (!('properties' in fullDefinition)) {
        return {};
    }

    const required = fullDefinition['required'];
    logRequiredMessage(logger, required, instantiateAll);

    const out = {};
    for (const [key, detail] of Object.entries(fullDefinition['properties'])) {
        if (!instantiateAll && required && !required.includes(key)) {
            logger.debug('Skipping property ' + key + ' as it is not marked as required.');
            continue;
        }
        if (detail?.type == 'object') {
            // recursive instantiation
            logger.debug('Recursively instantiating a metadata object');
            out[key] = instantiateMetadataObject(detail, schemaDirectory, instantiateAll, debug);
        }
        else {
            out[key] = getPropertyValue(key, detail);
        }
    }
    return out;
}

export function instantiateAllMetadata(pattern: object, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): object[] {
    const logger = initLogger(debug);
    const metadataObjects = pattern['properties']?.metadata?.prefixItems;
    if (!metadataObjects) {
        logger.debug('Warning: pattern has no metadata fields defined, skipping instantiation.');
        if (pattern['properties']?.metadata?.items) {
            logger.warn('Note: properties.metadata.items is deprecated: please use prefixItems instead.');
        }
        return [];
    }
    const outputMetadata = [];

    for (const node of metadataObjects) {
        outputMetadata.push(instantiateMetadataObject(node, schemaDirectory, debug, instantiateAll));
    }
    return outputMetadata;
}