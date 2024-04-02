import Ajv2020 from 'ajv/dist/2020.js';
import { existsSync, promises as fs } from "fs";
import pkg from '@stoplight/spectral-core';
const { Spectral } = pkg;
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js'


export default async function validate(jsonSchemaInstantiationPath: string, jsonSchemaPath: string) {
    // load schema method is needed to resolve URIs
    const ajv = (new Ajv2020({ strict: false, loadSchema: loadSchema }));

    const jsonSchemaInstantiation = await getFileFromUrlOrPath(jsonSchemaInstantiationPath);
    const jsonSchema = await getFileFromUrlOrPath(jsonSchemaPath);

    try {
        const validate = await ajv.compileAsync(jsonSchema);

        if (validate(jsonSchemaInstantiation)) {
            console.log("The schema instantiation matches the json schema");
        } else {
            console.log("The schema instantiation does not match the json schema");
            console.log("Problems: ")
            console.log(validate.errors);
        }

        await runSpectralValidations(jsonSchemaInstantiation);
    } catch (error) {
        console.error(`An error occured during the validation: `, error.message);
        process.exit(1);
    }
}

async function getFileFromUrlOrPath(input: string) {
    const urlPattern = new RegExp('^https?://');
    if (urlPattern.test(input)) {
        return await getFileFromUrl(input);
    } else {
        return await getFileFromPath(input);
    }
}

async function getFileFromUrl(fileUrl: string) {
    try {
        const res = await fetch(fileUrl);
        const body = await res.json();
        return body;
    } catch {
        console.error(`An issue occured while trying to retrieve JSON at ${fileUrl}`);
        process.exit(1);
    }
}

async function getFileFromPath(filePath: string) {
    if (existsSync(filePath)) {
        const file = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(file);
    } else {
        console.error(`File could not be found at ${filePath}`);
        process.exit(1);
    }
}

async function runSpectralValidations(jsonSchemaInstantiation: any) {
    const spectralRulesetUrl = "https://raw.githubusercontent.com/finos-labs/architecture-as-code/main/spectral/calm-validation-rules.yaml";
    const spectral = new Spectral();
    spectral.setRuleset(await getRuleset(spectralRulesetUrl));
    const issues = await spectral.run(jsonSchemaInstantiation);
    if (issues.length !== 0) {
        console.log('Spectral issues: ', issues);
        if (issues.filter(issue => issue.severity === 0).length !== 0) {
            process.exit(1);
        }
    }
}
async function loadSchema(uri) {
    try {
        const res = await fetch(uri);
        const body = await res.json();
        return body;
    } catch (error) {
        console.error(`Error occured while trying to load the schema at ${uri}. Error : ${error.message}`);
        process.exit(1);
    }
}