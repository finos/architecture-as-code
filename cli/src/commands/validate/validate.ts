import Ajv2020, { ErrorObject } from 'ajv/dist/2020.js';
import { existsSync, promises as fs, readFileSync, readdirSync, statSync } from 'fs';
import pkg, { ISpectralDiagnostic } from '@stoplight/spectral-core';
const { Spectral } = pkg;
import { getRuleset } from '@stoplight/spectral-cli/dist/services/linter/utils/getRuleset.js';
import { DiagnosticSeverity} from '@stoplight/types';
import * as winston from 'winston';
import { initLogger } from '../helper.js';
import { ValidationOutput as ValidationOutput } from './validation.output.js';
import { SpectralResult } from './spectral.result.js';
import  createJUnitReport  from './junit-report/junit.report.js';
import yaml from 'js-yaml';

let logger: winston.Logger; // defined later at startup

export default async function validate(jsonSchemaInstantiationLocation: string, jsonSchemaLocation: string, metaSchemaPath: string, debug: boolean = false, junitReportLocation?: string) {
    logger = initLogger(debug);
    let errors = false;
    let validations: ValidationOutput[] = [];
    try {
        const ajv = buildAjv2020(debug);

        loadMetaSchemas(ajv, metaSchemaPath);

        logger.info(`Loading pattern from : ${jsonSchemaLocation}`);
        const jsonSchema = await getFileFromUrlOrPath(jsonSchemaLocation);

        logger.info(`Loading pattern instantiation from : ${jsonSchemaInstantiationLocation}`);
        const jsonSchemaInstantiation = await getFileFromUrlOrPath(jsonSchemaInstantiationLocation);

        const validateSchema = ajv.compile(jsonSchema);

        const spectralRuleset = '../spectral/instantiation/validation-rules.yaml';
        const spectralResult: SpectralResult = await runSpectralValidations(jsonSchemaInstantiation, stripRefs(jsonSchema), spectralRuleset);

        errors = spectralResult.errors;
        validations = validations.concat(spectralResult.spectralIssues);

        let jsonSchemaValidations = [];
        if (!validateSchema(jsonSchemaInstantiation)) {
            logger.debug(`JSON Schema validation raw output: ${prettifyJson(validateSchema.errors)}`);
            errors = true;
            jsonSchemaValidations = formatJsonSchemaOutput(validateSchema.errors);
            validations = validations.concat(jsonSchemaValidations);
        }
        
        
        if(junitReportLocation) {
            logger.debug('Generating test report file');
            const spectralRules = extractRulesFromSpectralRuleset(spectralRuleset);
            createJUnitReport(jsonSchemaValidations, spectralResult.spectralIssues, spectralRules, 'test-report.xml');
        }

        if(errors){
            logger.error(`The following issues have been found on the JSON Schema instantiation ${prettifyJson(validations)}`);
            process.exit(1);
        }

        if(validations.length > 0){
            logger.info(`The following issues (not errors) have been found on the JSON Schema Instantiation ${prettifyJson(validations)}`);
        }else{
            logger.info('The JSON Schema instantiation is valid');
        }
        process.exit(0);

    } catch (error) {
        logger.error(`An error occured: ${error}`);
        process.exit(1);
    }
}

function buildAjv2020(debug: boolean): Ajv2020 {
    if (debug){
        return new Ajv2020({strict: 'log', allErrors: true});
    }
    return new Ajv2020({strict: false, allErrors: true});
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

async function runSpectralValidations(jsonSchemaInstantiation: string, jsonSchema: string, spectralRuleset: string): Promise<SpectralResult> {
    
    let errors = false;
    let spectralIssues: ValidationOutput[] = [];
    const spectral = new Spectral();

    spectral.setRuleset(await getRuleset(spectralRuleset));
    let issues = await spectral.run(jsonSchemaInstantiation);
    spectral.setRuleset(await getRuleset('../spectral/pattern/validation-rules.yaml'));
    issues = issues.concat(await spectral.run(jsonSchema));

    if (issues && issues.length > 0) {
        logger.debug(`Spectral raw output: ${prettifyJson(issues)}`);
        spectralIssues = formatSpectralOutput(issues);
        if (issues.filter(issue => issue.severity === 0).length > 0) {
            logger.debug('Spectral output contains errors');
            errors = true;
        }
    }
    return new SpectralResult(errors, spectralIssues);
}

function formatJsonSchemaOutput(jsonSchemaIssues: ErrorObject[]): ValidationOutput[]{
    const validationOutput : ValidationOutput[] = [];

    jsonSchemaIssues.forEach(issue => {
        const formattedIssue = new ValidationOutput(
            'json-schema', 
            'error', 
            issue.message, 
            issue.instancePath, 
            issue.schemaPath
        );
        validationOutput.push(formattedIssue);
    });

    return validationOutput;
}

function formatSpectralOutput(spectralIssues: ISpectralDiagnostic[]): ValidationOutput[] {
    const validationOutput : ValidationOutput[] = [];

    spectralIssues.forEach(issue => {
        const formattedIssue = new ValidationOutput(
            issue.code,
            getSeverity(issue.severity), 
            issue.message, 
            '/'+issue.path.join('/')
        );
        validationOutput.push(formattedIssue);
    });

    return validationOutput;
}

function getSeverity(spectralSeverity: DiagnosticSeverity): string {
    switch(spectralSeverity){
    case 0:
        return 'error';
    case 1:
        return 'warning';
    case 2:
        return 'info';
    case 3:
        return 'hint';
    default:
        throw Error('The spectralSeverity does not match the known values');
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

function extractRulesFromSpectralRuleset(spectralRuleset: string){
    const yamlData = yaml.load(readFileSync(spectralRuleset, 'utf-8'));
    return Object.keys(yamlData['rules']);
}

function prettifyJson(json){
    return JSON.stringify(json, null, 4);
}

function stripRefs(obj: object) : string {
    return JSON.stringify(obj).replaceAll('$ref', 'ref');
}

export const exportedForTesting = {
    formatSpectralOutput,
    formatJsonSchemaOutput,
    stripRefs
};