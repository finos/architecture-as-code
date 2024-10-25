import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { appendPath, logRequiredMessage, mergeSchemas } from '../util.js';
import { instantiateGenericObject } from './instantiate.js';

export function instantiateMetadataObject(definition: object, schemaDirectory: SchemaDirectory, path: string[], debug: boolean = false, instantiateAll: boolean = false): object {
    return instantiateGenericObject(definition, schemaDirectory, 'metadata', path, debug, instantiateAll);
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

    for (const [index, metadataObj] of metadataObjects.entries()) {
        const path = appendPath(['metadata'], index);
        outputMetadata.push(instantiateMetadataObject(metadataObj, schemaDirectory, path, debug, instantiateAll));
    }
    return outputMetadata;
}