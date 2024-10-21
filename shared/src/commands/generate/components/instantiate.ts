import { Logger } from "winston";
import { initLogger } from "../../helper";
import { SchemaDirectory } from "../schema-directory";
import { logRequiredMessage, mergeSchemas } from "../util";
import { getPropertyValue } from "./property";

export function instantiateGenericObject(definition: object, schemaDirectory: SchemaDirectory, objectType: string, debug: boolean = false, instantiateAll: boolean = false): object {
    const logger = initLogger(debug);
    let fullDefinition = definition;
    if (definition['$ref']) {
        const ref = definition['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, definition);
    }
    // logger.debug('Generating ' + objectType + ' object from ' + JSON.stringify(fullDefinition));
    
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
        if (detail?.type === 'object') {
            // recursive instantiation
            logger.info('Recursively instantiating an ' + objectType + ' object');
            out[key] = instantiateGenericObject(detail, schemaDirectory, objectType, instantiateAll, debug);
        }
        else if (detail?.type === 'array' && isArrayObjectComplex(detail, logger)) {
            logger.info('Recursively instantiating an array object.');

            // isArrayObjectComplex ensures this is present
            const prefixItems = detail.prefixItems;
            out[key] = instantiateArray(prefixItems, schemaDirectory, objectType, instantiateAll, debug);
        }
        else {
            out[key] = getPropertyValue(key, detail);
        }
    }
    return out;
}

function isArrayObjectComplex(detail: any, logger: Logger) {
    console.log(detail)
    if (!detail) {
        return false;
    }

    console.log(detail)

    const arrayContentsType = detail.items?.type
    if (!!arrayContentsType && ['integer', 'number', 'boolean', 'string', 'const'].includes(arrayContentsType)) {
        logger.info('Skipping recursive instantiation of array as it has a simple type and no prefixItems')
        return false
    }

    if (!!detail.prefixItems && !!detail.items) {
        logger.warn("Both 'items' and 'prefixItems' are defined on this array schema; only prefixItems will be instantiated.")
    }

    if (!!detail.prefixItems) {
        // if we have prefixItems and it's not a simple array, then must be complex.
        return true;
    }

    // fallback if there are neither - let property.ts handle the empty object
    return false;
}

export function instantiateArray(prefixItems: object[], schemaDirectory: SchemaDirectory, objectType: string, instantiateAll: boolean, debug: boolean) {
    const logger = initLogger(debug);
    const output = [];

    logger.debug("Instantiating elements of array as defined in prefixItems")
    for (const item of prefixItems) {
        output.push(instantiateGenericObject(item, schemaDirectory, objectType, debug, instantiateAll));
    }

    return output;
}

export function instantiateArrayObject(definition: object, schemaDirectory: SchemaDirectory, objectType: string, debug: boolean = false, instantiateAll: boolean = false): object {
    const logger = initLogger(debug);
    let fullDefinition = definition;
    if (definition['$ref']) {
        const ref = definition['$ref'];
        const schemaDef = schemaDirectory.getDefinition(ref); 

        fullDefinition = mergeSchemas(schemaDef, definition);
    }
    logger.debug('Generating ' + objectType + ' object from ' + JSON.stringify(fullDefinition));
    
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
        if (detail?.type === 'object') {
            // recursive instantiation
            logger.debug('Recursively instantiating an ' + objectType + ' object');
            out[key] = instantiateGenericObject(detail, schemaDirectory, objectType, instantiateAll, debug);
        }
        else if (detail?.type === 'array') {
            if (key === 'interfaces')
                logger.debug('Instantiating interfaces for a node object.');
            else
                logger.debug('Recursively instantiating an array object.');

        }
        else {
            out[key] = getPropertyValue(key, detail);
        }
    }
    return out;
}