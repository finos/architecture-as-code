import { Logger } from "winston";
import { initLogger } from "../../helper.js";
import { SchemaDirectory } from "../schema-directory.js";
import { appendPath, logRequiredMessage, mergeSchemas, renderPath } from "../util.js";
import { getConstValue, getPropertyValue } from "./property.js";

export function instantiateGenericObject(definition: object, schemaDirectory: SchemaDirectory, objectType: string, path: string[], debug: boolean = false, instantiateAll: boolean = false): object {
    const logger = initLogger(debug);
    let fullDefinition = definition;
    if (definition['$ref']) {
        const ref = definition['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, definition);
    }
    // TODO rework to properly separate 'verbose' from 'debug' level logging
    // logger.debug('Generating ' + objectType + ' object from ' + JSON.stringify(fullDefinition));
    
    if (!('properties' in fullDefinition)) {
        return {};
    }

    const required = fullDefinition['required'];
    logRequiredMessage(logger, required, instantiateAll);

    const out = {};
    for (const [key, detail] of Object.entries(fullDefinition['properties'])) {
        const currentPath = appendPath(path, key);
        const renderedPath = renderPath(currentPath);
        
        if (!instantiateAll && required && !required.includes(key)) { // TODO should we always do interfaces even if not required?
            if (key === 'interfaces') {
                logger.warn(`${renderedPath}: 'interfaces' property was not marked as required. You might be missing some values if this object has interfaces defined.`)
            }
            logger.debug(`${renderedPath}: Skipping property ${key} as it is not marked as required.`);
            continue;
        }
        if (!!detail?.const) {
            out[key] = getConstValue(detail);
        }
        else if (detail?.type === 'object') {
            // recursive instantiation
            logger.info(`${renderedPath}: Recursively instantiating a ${objectType} object`);
            out[key] = instantiateGenericObject(detail, schemaDirectory, objectType, currentPath, instantiateAll, debug);
        }
        else if (detail?.type === 'array' && isArrayObjectComplex(detail, logger, renderedPath)) {
            logger.info(`${renderedPath}: Recursively instantiating an array object.`);

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

function isArrayObjectComplex(detail: any, logger: Logger, pathContext: string) {
    if (!detail) {
        return false;
    }

    const arrayContentsType = detail.items?.type
    if (!!arrayContentsType && ['integer', 'number', 'boolean', 'string', 'const'].includes(arrayContentsType)) {
        logger.info(`${pathContext}: Skipping recursive instantiation of array as it has a simple type and no prefixItems`)
        return false
    }

    if (!!detail.prefixItems && !!detail.items) {
        logger.warn(`${pathContext}: Both 'items' and 'prefixItems' are defined on this array schema; only prefixItems will be instantiated.`)
    }

    if (!!detail.prefixItems) {
        // if we have prefixItems and it's not a simple array, then must be complex.
        return true;
    }

    // fallback if there are neither - let property.ts handle the empty object
    return false;
}

export function instantiateArray(prefixItems: object[], schemaDirectory: SchemaDirectory, objectType: string, path: string[], instantiateAll: boolean, debug: boolean) {
    const logger = initLogger(debug);
    const output = [];

    logger.debug(`${path}: Instantiating elements of array as defined in prefixItems`)
    for (const [index, element] of prefixItems.entries()) {
        const currentPath = appendPath(path, index)
        output.push(instantiateGenericObject(element, schemaDirectory, objectType, currentPath, debug, instantiateAll));
    }

    return output;
}