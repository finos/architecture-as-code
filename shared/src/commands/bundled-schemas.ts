import { readdirSync } from 'fs';
import { CALM_META_SCHEMA_DIRECTORY } from '../consts';
import { initLogger } from './helper';

const calmSchemaRegex = new RegExp('https://.*/draft/([0-9-]+)/meta/.*');

export function getBundledSchemaVersion(debug: boolean): string {
    const logger = initLogger(debug);
    try {
        const files = readdirSync(CALM_META_SCHEMA_DIRECTORY);
        if (files.length > 0) {
            return files[0];
        }
    }
    catch (_) {
        logger.warn('Error looking up bundled CALM schemas. Disabling checks for incorrect core schema versions.');
        return null;
    }
    logger.warn('Did not find bundled CALM schemas. Disabling checks for incorrect core schema versions.');
    return null;
}

/**
 * Check whether a Schema URL is a core CALM schema, and if it is, log a warning if it doesn't match the bundled version.
 * @param uri The schema URI to check
 * @param bundledVersion The CALM schema version that was loaded
 * @param debug Whether to log debug info
 * @returns true if the schema version is valid, false otherwise
 */
export function checkCoreSchemaVersion(uri: string, bundledVersion: string, debug: boolean) {
    const logger = initLogger(debug);

    if (bundledVersion === null) {
        return true;
    }

    const matches = calmSchemaRegex.exec(uri);

    if (!matches || matches.length < 2) {
        // not a CALM core schema
        return true;
    }

    const requestedCoreSchemaVersion = matches[1];
    if (requestedCoreSchemaVersion === bundledVersion) {
        return true;
    }

    const warningMessage = `WARNING: attempting to load a core CALM schema with a version (${requestedCoreSchemaVersion}) that was not bundled with the CALM CLI. ` + 
        'This may produce unexpected errors. ' +
        `The bundled version is ${bundledVersion}. `;
    logger.warn(warningMessage);
    return false;
}