import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, promises as fs } from 'fs';
import pkg from '@stoplight/spectral-core';
const { Spectral } = pkg;
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js';

export default async function validate(jsonSchemaInstantiationLocation: string, jsonSchemaPath: string) {
    let exitCode = 0;
    try {
        const ajv = (new Ajv2020({ strict: false, loadSchema: loadFileFromUrl}));

        

        console.info(`Loading pattern from : ${jsonSchemaPath}`);
        const jsonSchema = await getFileFromUrlOrPath(jsonSchemaPath);

        console.info(`Loading pattern instantiation from : ${jsonSchemaInstantiationLocation}`);
        const jsonSchemaInstantiation = await getFileFromUrlOrPath(jsonSchemaInstantiationLocation);
        
        const validateSchema = await ajv.compileAsync(jsonSchema);

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

async function runSpectralValidations(jsonSchemaInstantiation: any) {
    const spectralRulesetUrl = 'https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/spectral/calm-validation-rules.yaml';
    const spectral = new Spectral();
    spectral.setRuleset(await getRuleset(spectralRulesetUrl));
    const issues = await spectral.run(jsonSchemaInstantiation);
    if (issues !== undefined && issues.length !== 0) {
        console.info('Spectral issues: ', issues);
        if (issues.filter(issue => issue.severity === 0).length !== 0) {
            //Exit with 1 if any of the Spectral issues is severity error 
            process.exit(1);
        }
    }
}

async function getFileFromUrlOrPath(input: string) {
    const urlPattern = new RegExp('^https?://');
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