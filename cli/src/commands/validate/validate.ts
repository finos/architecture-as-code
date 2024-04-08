import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, promises as fs, readFileSync, readdirSync, statSync } from 'fs';
import pkg from '@stoplight/spectral-core';
const { Spectral } = pkg;
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js';
import * as winston from 'winston';

let logger: winston.Logger; // defined later at startup

export default async function validate(jsonSchemaInstantiationLocation: string, jsonSchemaLocation: string, metaSchemaPath: string, debug: boolean) {
    initLogger(debug);
    let exitCode = 0;
    try {
        const ajv = new Ajv2020({ strict: false });

        loadMetaSchemas(ajv, metaSchemaPath);

        logger.info(`Loading pattern from : ${jsonSchemaLocation}`);
        const jsonSchema = await getFileFromUrlOrPath(jsonSchemaLocation);

        logger.info(`Loading pattern instantiation from : ${jsonSchemaInstantiationLocation}`);
        const jsonSchemaInstantiation = await getFileFromUrlOrPath(jsonSchemaInstantiationLocation);

        const validateSchema = ajv.compile(jsonSchema);

        if (!validateSchema(jsonSchemaInstantiation)) {
            logger.error(`The instantiation does not match the JSON schema pattern. Errors: ${prettifyJson(validateSchema.errors)}'`);
            exitCode = 1;
        } else {
            logger.info('The schema instantiation matches the json schema');
        }

        await runSpectralValidations(jsonSchemaInstantiation);
    } catch (error) {
        logger.error(`An error occured: ${error}`);
        process.exit(1);
    }
    process.exit(exitCode);
}

function initLogger(debug: boolean): void {
    const level = debug ? 'debug' : 'info';
    logger = winston.createLogger({
        transports: [
            new winston.transports.Console()
        ],
        level: level,
        format: winston.format.combine(
            winston.format.cli(),
        )
    });
}

function loadMetaSchemas(ajv: Ajv2020, metaSchemaLocation: string) {
    logger.info(`Loading meta schema(s) from ${metaSchemaLocation}`);

    if (!statSync(metaSchemaLocation).isDirectory()) {
        throw new Error(`The metaSchemaLocation: ${metaSchemaLocation} is not a directory`);
    }

    const filenames = readdirSync(metaSchemaLocation);

    if (filenames.length === 0) {
        throw new Error(`The metaSchemaLocation: ${metaSchemaLocation} is an empty directory`);
    }

    filenames.forEach(filename => {
        if (filename.endsWith('.json')) {
            logger.debug('Adding meta schema : ' + filename);
            const meta = JSON.parse(readFileSync(metaSchemaLocation + '/' + filename, 'utf8'));
            ajv.addMetaSchema(meta);
        }
    });
}

async function runSpectralValidations(jsonSchemaInstantiation: string) {
    const spectral = new Spectral();
    spectral.setRuleset(await getRuleset('../spectral/calm-validation-rules.yaml'));
    const issues = await spectral.run(jsonSchemaInstantiation);
    if (issues && issues.length > 0) {
        logger.info(`Spectral issues: ${prettifyJson(issues)}`);
        if (issues.filter(issue => issue.severity === 0).length > 0) {
            //Exit with 1 if any of the Spectral issues is an error
            process.exit(1);
        }
    }
}

async function getFileFromUrlOrPath(input: string) {
    const urlPattern = /^https?:\/\//;
    if (urlPattern.test(input)) {
        return await loadFileFromUrl(input);
    }
    return await getFileFromPath(input);
}

async function getFileFromPath(filePath: string) {
    if (!existsSync(filePath)) {
        throw new Error(`File could not be found at ${filePath}`);
    }
    const file = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(file);
}

async function loadFileFromUrl(fileUrl: string) {
    const res = await fetch(fileUrl);
    if (!res.ok) {
        throw new Error(`The http request to ${fileUrl} did not succeed. Status code ${res.status}`);
    }
    const body = await res.json();
    return body;
}

function prettifyJson(json){
    return JSON.stringify(json, null, 4);
}