import { Logger } from 'winston';
import { initLogger } from '../../helper.js';
import { SchemaDirectory } from '../schema-directory.js';
import { appendPath, logRequiredMessage, mergeSchemas, renderPath } from '../util.js';
import { getConstValue, getEnumPlaceholder, getPropertyValue } from './property.js';

export function instantiateGenericObject(definition: object, schemaDirectory: SchemaDirectory, objectType: string, path: string[], debug: boolean = false, instantiateAll: boolean = false): object | string {
    const logger = initLogger(debug);
    let fullDefinition = definition;
    if (definition['$ref']) {
        const ref = definition['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, definition);

        if ('enum' in fullDefinition) {
            logger.debug(`Generating an enum definition. $ref: ${ref}`);
            const placeholder = getEnumPlaceholder(ref);
            logger.info(`Generated an enum placeholder ${placeholder}. Potential values for this enum are: ${fullDefinition.enum}`);
            return placeholder;
        }
    }
    
    if (!('properties' in fullDefinition)) {
        logger.warn('Attempting to resolve an empty definition. Returning {}.');
        return {};
    }

    const required = fullDefinition['required'];
    logRequiredMessage(logger, required, instantiateAll);

    logger.debug(`${renderPath(path)}: Instantiating generic object. Full definition: ${JSON.stringify(fullDefinition, null, 2)}`);

    const out = {};
    for (const [key, detail] of Object.entries(fullDefinition['properties'])) {
        const currentPath = appendPath<string>(path, key);
        const renderedPath = renderPath(currentPath);

        logger.debug(`${renderedPath}: Generating definition for key ${key}: ${JSON.stringify(detail, null, 2)}`);
        
        if (!instantiateAll && required && !required.includes(key) && key !== 'interfaces') { 
            logger.debug(`${renderedPath}: Skipping property ${key} as it is not marked as required.`);
            continue;
        }
        if (detail?.const) {
            out[key] = getConstValue(detail);
        }
        else if (detail?.type === 'object') {
            // recursive instantiation
            logger.debug(`${renderedPath}: Recursively instantiating an object`);
            out[key] = instantiateGenericObject(detail, schemaDirectory, objectType, currentPath, instantiateAll, debug);
        }
        else if (detail['$ref']) {
            logger.debug(`${renderedPath}: Recursively instantiating a ${objectType} object via a $ref`);
            out[key] = instantiateGenericObject(detail, schemaDirectory, objectType, currentPath, instantiateAll, debug);
        }
        else if (detail?.type === 'array' && isArrayObjectComplex(detail, logger, renderedPath)) {
            logger.debug(`${renderedPath}: Recursively instantiating an array object.`);

            // isArrayObjectComplex ensures this is present
            const prefixItems = detail.prefixItems;
            out[key] = instantiateArray(prefixItems, schemaDirectory, objectType, currentPath, instantiateAll, debug);
        }
        else {
            out[key] = getPropertyValue(key, detail);
        }
    }
    return out;
}

function isArrayObjectComplex(detail: object, logger: Logger, pathContext: string) {
    if (!detail) {
        return false;
    }

    const arrayContentsType = detail['items']?.type;
    if (!!arrayContentsType && ['integer', 'number', 'boolean', 'string', 'const'].includes(arrayContentsType)) {
        logger.info(`${pathContext}: Skipping recursive instantiation of array as it has a simple type and no prefixItems`);
        return false;
    }

    if (!!detail['prefixItems'] && !!detail['items']) {
        logger.warn(`${pathContext}: Both 'items' and 'prefixItems' are defined on this array schema; only prefixItems will be instantiated.`);
    }

    if (detail['prefixItems']) {
        // if we have prefixItems and it's not a simple array, then must be complex.
        return true;
    }

    // fallback if there are neither - let property.ts handle the empty object
    return false;
}

export function instantiateArray(prefixItems: object[], schemaDirectory: SchemaDirectory, objectType: string, path: string[], instantiateAll: boolean, debug: boolean) {
    const logger = initLogger(debug);
    const output = [];

    const renderedPath = renderPath(path);
    logger.debug(`${renderedPath}: Instantiating elements of array as defined in prefixItems`);
    for (const [index, element] of prefixItems.entries()) {
        const currentPath = appendPath<string>(path, index.toString());
        output.push(instantiateGenericObject(element, schemaDirectory, objectType, currentPath, debug, instantiateAll));
    }

    return output;
}