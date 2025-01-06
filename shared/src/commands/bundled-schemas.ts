import { readdirSync } from "fs";
import { CALM_META_SCHEMA_DIRECTORY } from "../consts";
import { initLogger } from "./helper";

const calmSchemaRegex = new RegExp('https://.*/draft/([0-9-]+)/meta/.*');

export function getBundledSchemaVersion(debug: boolean): string {
    const logger = initLogger(debug);
    try {
        var files = readdirSync(CALM_META_SCHEMA_DIRECTORY);
        if (files.length > 0) {
            return files[0];
        }
    }
    catch (e) {
        logger.warn("Error looking up bundled CALM schemas. Disabling checks for incorrect core schema versions.")
        return null;
    }
    logger.warn("Did not find bundled CALM schemas. Disabling checks for incorrect core schema versions.")
    return null;
}

export function checkCoreSchemaVersion(uri: string, bundledVersion: string, debug: boolean) {
    const logger = initLogger(debug);

    if (bundledVersion === null) {
        return false;
    }

    const matches = calmSchemaRegex.exec(uri);

    if (!matches || matches.length < 2) {
        return false;
    }

    const requestedCoreSchemaVersion = matches[1];
    if (requestedCoreSchemaVersion === bundledVersion) {
        return false;
    }

    const warningMessage = `WARNING: attempting to load a core CALM schema with a version (${requestedCoreSchemaVersion}) that was not bundled with the CALM CLI. ` + 
        `This may produce unexpected errors. ` +
        `The bundled version is ${bundledVersion}. `;
    logger.warn(warningMessage);
    return true;
}