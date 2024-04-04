import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, promises as fs, readFileSync, readdirSync, statSync } from 'fs';
import pkg from '@stoplight/spectral-core';
const { Spectral } = pkg;
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js';

export default async function validate(jsonSchemaInstantiationLocation: string, jsonSchemaLocation: string, metaSchemaPath: string) {
    let exitCode = 0;
    try {
        const ajv = new Ajv2020({ strict: false });

        loadMetaSchemas(ajv, metaSchemaPath);

        console.info(`Loading pattern from : ${jsonSchemaLocation}`);
        const jsonSchema = await getFileFromUrlOrPath(jsonSchemaLocation);

        console.info(`Loading pattern instantiation from : ${jsonSchemaInstantiationLocation}`);
        const jsonSchemaInstantiation = await getFileFromUrlOrPath(jsonSchemaInstantiationLocation);

        const validateSchema = ajv.compile(jsonSchema);

        if (!validateSchema(jsonSchemaInstantiation)) {
            console.error('The instantiation does not match the JSON schema pattern. Errors: ', validateSchema.errors);
            exitCode = 1;
        } else {
            console.info('The schema instantiation matches the json schema');
        }

        await runSpectralValidations(jsonSchemaInstantiation);
    } catch (error) {
        console.error(`An error occured: ${error}`);
        process.exit(1);
    }
    process.exit(exitCode);
}

function loadMetaSchemas(ajv: Ajv2020, metaSchemaLocation: string) {
    console.log(`Loading meta schema(s) from ${metaSchemaLocation}`);

    if (!statSync(metaSchemaLocation).isDirectory()) {
        throw new Error(`The metaSchemaLocation: ${metaSchemaLocation} is not a directory`);
    }

    const filenames = readdirSync(metaSchemaLocation);

    if (filenames.length === 0) {
        throw new Error(`The metaSchemaLocation: ${metaSchemaLocation} is an empty directory`);
    }

    filenames.forEach(filename => {
        if (filename.endsWith('.json')) {
            console.log('Adding meta schema : ' + filename);
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
        console.info('Spectral issues: ', issues);
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