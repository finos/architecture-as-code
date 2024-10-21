import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { logRequiredMessage, mergeSchemas } from '../util.js';
import { instantiateGenericObject } from './instantiate.js';
import { getPropertyValue } from './property.js';

export function instantiateMetadataObject(definition: object, schemaDirectory: SchemaDirectory, debug: boolean = false, instantiateAll: boolean = false): object {
    return instantiateGenericObject(definition, schemaDirectory, 'metadata', debug, instantiateAll);
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